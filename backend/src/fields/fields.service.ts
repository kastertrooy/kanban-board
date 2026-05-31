import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FieldDefinition, FieldType, Prisma } from '@prisma/client';

import { BoardGateway } from '../boards/board.gateway';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFieldDefinitionDto,
  UpdateFieldDefinitionDto,
} from './dto/field-definition.dto';
import { UpsertFieldValueDto } from './dto/field-value.dto';

type FieldValueWithUsers = Prisma.FieldValueGetPayload<{
  include: {
    users: {
      include: {
        user: {
          select: {
            id: true;
            email: true;
            name: true;
            avatarUrl: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class FieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardGateway: BoardGateway,
  ) {}

  async createFieldDefinition(
    boardId: string,
    dto: CreateFieldDefinitionDto,
  ): Promise<FieldDefinition> {
    if (dto.type === FieldType.SELECT && dto.options === undefined) {
      throw new BadRequestException('SELECT field requires options');
    }

    this.validateFieldOptions(dto.type, dto.options);

    await this.ensureBoardExists(boardId);

    const lastField = await this.prisma.fieldDefinition.findFirst({
      where: {
        boardId,
        deletedAt: null,
      },
      orderBy: {
        order: 'desc',
      },
      select: {
        order: true,
      },
    });

    const fieldDefinition = await this.prisma.fieldDefinition.create({
      data: {
        boardId,
        name: dto.name.trim(),
        type: dto.type,
        isRequired: dto.isRequired ?? false,
      options: this.normalizeFieldOptions(dto.options),
        order: (lastField?.order ?? -1) + 1,
      },
    });

    this.boardGateway.notifyBoard(boardId, 'field_definition_created', fieldDefinition);

    return fieldDefinition;
  }

  async updateFieldDefinition(
    boardId: string,
    fieldId: string,
    dto: UpdateFieldDefinitionDto,
  ): Promise<FieldDefinition> {
    const existingField = await this.prisma.fieldDefinition.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        boardId: true,
        type: true,
        deletedAt: true,
      },
    });

    if (!existingField || existingField.boardId !== boardId) {
      throw new NotFoundException('Field definition not found');
    }

    if (existingField.deletedAt) {
      throw new BadRequestException('Deleted field definition cannot be updated');
    }

    this.validateFieldOptions(existingField.type, dto.options);

    const fieldDefinition = await this.prisma.fieldDefinition.update({
      where: { id: fieldId },
      data: {
        name: dto.name?.trim(),
        isRequired: dto.isRequired,
        options: dto.options === undefined ? undefined : this.normalizeFieldOptions(dto.options),
      },
    });

    this.boardGateway.notifyBoard(boardId, 'field_definition_updated', fieldDefinition);

    return fieldDefinition;
  }

  async softDeleteFieldDefinition(
    boardId: string,
    fieldId: string,
  ): Promise<{ success: true }> {
    const existingField = await this.prisma.fieldDefinition.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        boardId: true,
        deletedAt: true,
      },
    });

    if (!existingField || existingField.boardId !== boardId) {
      throw new NotFoundException('Field definition not found');
    }

    if (!existingField.deletedAt) {
      const deletedAt = new Date();

      await this.prisma.fieldDefinition.update({
        where: { id: fieldId },
        data: {
          deletedAt,
        },
      });

      this.boardGateway.notifyBoard(boardId, 'field_definition_deleted', {
        boardId,
        fieldId,
        deletedAt,
      });

      return { success: true };
    }

    return { success: true };
  }

  async upsertFieldValue(
    cardId: string,
    fieldId: string,
    dto: UpsertFieldValueDto,
  ): Promise<FieldValueWithUsers> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const fieldDefinition = await this.prisma.fieldDefinition.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        boardId: true,
        type: true,
        deletedAt: true,
        isRequired: true,
        options: true,
      },
    });

    if (!fieldDefinition || fieldDefinition.boardId !== card.boardId) {
      throw new NotFoundException('Field definition not found');
    }

    if (fieldDefinition.deletedAt) {
      throw new BadRequestException('Cannot update value for deleted field definition');
    }

    this.validateFieldValuePayload(fieldDefinition.type, dto, fieldDefinition.isRequired);
    this.validateFieldValueAgainstOptions(fieldDefinition.type, fieldDefinition.options, dto);

    const fieldValue = await this.prisma.$transaction(async (tx) => {
      const baseValue = await tx.fieldValue.upsert({
        where: {
          cardId_fieldDefId: {
            cardId,
            fieldDefId: fieldId,
          },
        },
        update: this.buildScalarFieldValueUpdate(fieldDefinition.type, dto),
        create: {
          cardId,
          fieldDefId: fieldId,
          ...(this.buildScalarFieldValueCreate(fieldDefinition.type, dto) as any),
        },
      });

      if (fieldDefinition.type === FieldType.USER) {
        const requestedUserIds = dto.userIds ?? [];
        const existingRelations = await tx.fieldValueUser.findMany({
          where: { fieldValueId: baseValue.id },
          select: { userId: true },
        });

        const existingUserIds = new Set(existingRelations.map((item) => item.userId));
        const requestedSet = new Set(requestedUserIds);

        const usersInBoard = await tx.user.findMany({
          where: {
            id: {
              in: requestedUserIds,
            },
            OR: [
              {
                boards: {
                  some: {
                    id: card.boardId,
                  },
                },
              },
              {
                memberships: {
                  some: {
                    boardId: card.boardId,
                  },
                },
              },
            ],
          },
          select: {
            id: true,
          },
        });

        if (usersInBoard.length !== requestedUserIds.length) {
          throw new BadRequestException('One or more users do not belong to this board');
        }

        const usersToDelete = [...existingUserIds].filter((userId) => !requestedSet.has(userId));
        const usersToCreate = requestedUserIds.filter((userId) => !existingUserIds.has(userId));

        if (usersToDelete.length > 0) {
          await tx.fieldValueUser.deleteMany({
            where: {
              fieldValueId: baseValue.id,
              userId: {
                in: usersToDelete,
              },
            },
          });
        }

        if (usersToCreate.length > 0) {
          await tx.fieldValueUser.createMany({
            data: usersToCreate.map((userId) => ({
              fieldValueId: baseValue.id,
              userId,
            })),
            skipDuplicates: true,
          });
        }

        await tx.fieldValue.update({
          where: { id: baseValue.id },
          data: {
            valueText: null,
            valueNumber: null,
            valueDate: null,
          },
        });
      } else {
        await tx.fieldValueUser.deleteMany({
          where: {
            fieldValueId: baseValue.id,
          },
        });
      }

      return tx.fieldValue.findUniqueOrThrow({
        where: { id: baseValue.id },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
    });

    this.boardGateway.notifyBoard(card.boardId, 'card_field_updated', {
      boardId: card.boardId,
      cardId,
      fieldId,
      fieldValue,
    });

    return fieldValue;
  }

  private buildScalarFieldValueUpdate(
    fieldType: FieldType,
    dto: UpsertFieldValueDto,
  ): Prisma.FieldValueUpdateInput {
    if (fieldType === FieldType.USER) {
      return {
        valueText: null,
        valueNumber: null,
        valueDate: null,
      };
    }

    return {
      valueText: this.resolveValueText(fieldType, dto),
      valueNumber: fieldType === FieldType.NUMBER ? dto.valueNumber ?? null : null,
      valueDate: fieldType === FieldType.DATE ? dto.valueDate ?? null : null,
    };
  }

  private buildScalarFieldValueCreate(
    fieldType: FieldType,
    dto: UpsertFieldValueDto,
  ): Prisma.FieldValueUpdateInput {
    if (fieldType === FieldType.USER) {
      return {
        valueText: null,
        valueNumber: null,
        valueDate: null,
      };
    }

    return {
      valueText: this.resolveValueText(fieldType, dto),
      valueNumber: fieldType === FieldType.NUMBER ? dto.valueNumber ?? null : null,
      valueDate: fieldType === FieldType.DATE ? dto.valueDate ?? null : null,
    };
  }

  private resolveValueText(fieldType: FieldType, dto: UpsertFieldValueDto): string | null {
    if (fieldType === FieldType.TEXT || fieldType === FieldType.SELECT || fieldType === FieldType.COLOR) {
      return dto.valueText?.trim() ?? null;
    }

    return null;
  }

  private normalizeFieldOptions(
    options: Prisma.InputJsonValue | null | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
    if (options === null) {
      return Prisma.DbNull;
    }

    return options;
  }

  private validateFieldOptions(
    fieldType: FieldType,
    options: Prisma.InputJsonValue | null | undefined,
  ): void {
    if ((fieldType as any) === FieldType.SELECT) {
      if (options === undefined) {
        return;
      }

      if (!Array.isArray(options) || options.some((item) => typeof item !== 'string')) {
        throw new BadRequestException('SELECT field options must be an array of strings');
      }

      return;
    }

    if ((fieldType as any) !== FieldType.SELECT && options !== undefined && options !== null) {
      throw new BadRequestException('Options are supported only for SELECT fields');
    }
  }

  private validateFieldValueAgainstOptions(
    fieldType: FieldType,
    options: Prisma.JsonValue | null,
    dto: UpsertFieldValueDto,
  ): void {
    if ((fieldType as any) !== FieldType.SELECT || dto.valueText === undefined) {
      return;
    }

    if (!Array.isArray(options) || !options.every((item) => typeof item === 'string')) {
      throw new BadRequestException('SELECT field options are invalid');
    }

    if (!options.includes(dto.valueText)) {
      throw new BadRequestException('SELECT field value is not in allowed options');
    }
  }

  private validateFieldValuePayload(
    fieldType: FieldType,
    dto: UpsertFieldValueDto,
    isRequired: boolean,
  ): void {
    const scalarFieldsCount = [dto.valueText, dto.valueNumber, dto.valueDate]
      .filter((value) => value !== undefined)
      .length;
    const hasUserIds = dto.userIds !== undefined;

    if (fieldType === FieldType.USER) {
      if (scalarFieldsCount > 0) {
        throw new BadRequestException('USER field accepts only userIds');
      }

      if (isRequired && (!dto.userIds || dto.userIds.length === 0)) {
        throw new BadRequestException('USER field value is required');
      }

      return;
    }

    if (hasUserIds) {
      throw new BadRequestException('userIds are allowed only for USER fields');
    }

    if (scalarFieldsCount === 0 && isRequired) {
      throw new BadRequestException('Field value is required');
    }

    if (scalarFieldsCount > 1) {
      throw new BadRequestException('Only one value type can be updated at a time');
    }

    if (fieldType === FieldType.NUMBER && dto.valueNumber === undefined && scalarFieldsCount > 0) {
      throw new BadRequestException('NUMBER field requires valueNumber');
    }

    if (fieldType === FieldType.DATE && dto.valueDate === undefined && scalarFieldsCount > 0) {
      throw new BadRequestException('DATE field requires valueDate');
    }

    if (
      (fieldType === FieldType.TEXT || fieldType === FieldType.SELECT || fieldType === FieldType.COLOR)
      && dto.valueText === undefined
      && scalarFieldsCount > 0
    ) {
      throw new BadRequestException(`${fieldType} field requires valueText`);
    }

    if (fieldType === FieldType.TEXT && dto.valueText !== undefined) {
      return;
    }

    if (fieldType === FieldType.SELECT && dto.valueText !== undefined) {
      return;
    }

    if (fieldType === FieldType.COLOR && dto.valueText !== undefined) {
      return;
    }

    if (fieldType === FieldType.NUMBER && dto.valueNumber !== undefined) {
      return;
    }

    if (fieldType === FieldType.DATE && dto.valueDate !== undefined) {
      return;
    }

    if (scalarFieldsCount > 0) {
      throw new BadRequestException('Payload does not match field type');
    }
  }

  private async ensureBoardExists(boardId: string): Promise<void> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }
  }
}
