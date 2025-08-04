"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
const internals_1 = require("@prisma/internals");
const fs_1 = require("fs");
const helpers_1 = require("./helpers");
const aggregate_helpers_1 = require("./helpers/aggregate-helpers");
const transformer_1 = __importDefault(require("./transformer"));
const removeDir_1 = __importDefault(require("./utils/removeDir"));
async function generate(options) {
    var _a, _b;
    try {
        await handleGeneratorOutputValue(options.generator.output);
        const prismaClientGeneratorConfig = getGeneratorConfigByProvider(options.otherGenerators, 'prisma-client-js') ||
            getGeneratorConfigByProvider(options.otherGenerators, 'prisma-client');
        if (!prismaClientGeneratorConfig) {
            throw new Error('Prisma Zod Generator requires either "prisma-client-js" or "prisma-client" generator to be present in your schema.prisma file.\n\n' +
                'Please add one of the following to your schema.prisma:\n\n' +
                '// For the legacy generator:\n' +
                'generator client {\n' +
                '  provider = "prisma-client-js"\n' +
                '}\n\n' +
                '// Or for the new generator (Prisma 6.12.0+):\n' +
                'generator client {\n' +
                '  provider = "prisma-client"\n' +
                '}');
        }
        const prismaClientDmmf = await (0, internals_1.getDMMF)({
            datamodel: options.datamodel,
            previewFeatures: prismaClientGeneratorConfig === null || prismaClientGeneratorConfig === void 0 ? void 0 : prismaClientGeneratorConfig.previewFeatures,
        });
        checkForCustomPrismaClientOutputPath(prismaClientGeneratorConfig);
        setPrismaClientProvider(prismaClientGeneratorConfig);
        setPrismaClientConfig(prismaClientGeneratorConfig);
        const modelOperations = prismaClientDmmf.mappings.modelOperations;
        const inputObjectTypes = prismaClientDmmf.schema.inputObjectTypes.prisma;
        // Filter out AndReturn types that were introduced in Prisma 6 but shouldn't have Zod schemas
        const outputObjectTypes = prismaClientDmmf.schema.outputObjectTypes.prisma.filter((type) => !type.name.includes('AndReturn'));
        const enumTypes = prismaClientDmmf.schema.enumTypes;
        const models = [...prismaClientDmmf.datamodel.models];
        const mutableModelOperations = [...modelOperations];
        const mutableEnumTypes = {
            model: enumTypes.model ? [...enumTypes.model] : undefined,
            prisma: [...enumTypes.prisma],
        };
        const hiddenModels = [];
        const hiddenFields = [];
        (0, helpers_1.resolveModelsComments)(models, mutableModelOperations, mutableEnumTypes, hiddenModels, hiddenFields);
        await generateEnumSchemas(mutableEnumTypes.prisma, (_a = mutableEnumTypes.model) !== null && _a !== void 0 ? _a : []);
        const dataSource = (_b = options.datasources) === null || _b === void 0 ? void 0 : _b[0];
        const previewFeatures = prismaClientGeneratorConfig === null || prismaClientGeneratorConfig === void 0 ? void 0 : prismaClientGeneratorConfig.previewFeatures;
        transformer_1.default.provider = dataSource.provider;
        transformer_1.default.previewFeatures = previewFeatures;
        const generatorConfigOptions = options.generator.config;
        const addMissingInputObjectTypeOptions = (0, helpers_1.resolveAddMissingInputObjectTypeOptions)(generatorConfigOptions);
        const mutableInputObjectTypes = [...inputObjectTypes];
        const mutableOutputObjectTypes = [...outputObjectTypes];
        (0, helpers_1.addMissingInputObjectTypes)(mutableInputObjectTypes, mutableOutputObjectTypes, models, mutableModelOperations, dataSource.provider, addMissingInputObjectTypeOptions);
        const aggregateOperationSupport = (0, aggregate_helpers_1.resolveAggregateOperationSupport)(mutableInputObjectTypes);
        (0, helpers_1.hideInputObjectTypesAndRelatedFields)(mutableInputObjectTypes, hiddenModels, hiddenFields);
        await generateObjectSchemas(mutableInputObjectTypes);
        await generateModelSchemas(models, mutableModelOperations, aggregateOperationSupport);
        await generateIndex();
    }
    catch (error) {
        console.error(error);
    }
}
async function handleGeneratorOutputValue(generatorOutputValue) {
    const outputDirectoryPath = (0, internals_1.parseEnvValue)(generatorOutputValue);
    // create the output directory and delete contents that might exist from a previous run
    await fs_1.promises.mkdir(outputDirectoryPath, { recursive: true });
    const isRemoveContentsOnly = true;
    await (0, removeDir_1.default)(outputDirectoryPath, isRemoveContentsOnly);
    transformer_1.default.setOutputPath(outputDirectoryPath);
}
function getGeneratorConfigByProvider(generators, provider) {
    return generators.find((it) => (0, internals_1.parseEnvValue)(it.provider) === provider);
}
function checkForCustomPrismaClientOutputPath(prismaClientGeneratorConfig) {
    var _a;
    if (prismaClientGeneratorConfig === null || prismaClientGeneratorConfig === void 0 ? void 0 : prismaClientGeneratorConfig.isCustomOutput) {
        transformer_1.default.setPrismaClientOutputPath((_a = prismaClientGeneratorConfig.output) === null || _a === void 0 ? void 0 : _a.value);
    }
}
function setPrismaClientProvider(prismaClientGeneratorConfig) {
    if (prismaClientGeneratorConfig === null || prismaClientGeneratorConfig === void 0 ? void 0 : prismaClientGeneratorConfig.provider) {
        transformer_1.default.setPrismaClientProvider((0, internals_1.parseEnvValue)(prismaClientGeneratorConfig.provider));
    }
}
function setPrismaClientConfig(prismaClientGeneratorConfig) {
    if (prismaClientGeneratorConfig === null || prismaClientGeneratorConfig === void 0 ? void 0 : prismaClientGeneratorConfig.config) {
        transformer_1.default.setPrismaClientConfig(prismaClientGeneratorConfig.config);
    }
}
async function generateEnumSchemas(prismaSchemaEnum, modelSchemaEnum) {
    const enumTypes = [...prismaSchemaEnum, ...modelSchemaEnum];
    const enumNames = enumTypes.map((enumItem) => enumItem.name);
    transformer_1.default.enumNames = enumNames !== null && enumNames !== void 0 ? enumNames : [];
    const transformer = new transformer_1.default({
        enumTypes,
    });
    await transformer.generateEnumSchemas();
}
async function generateObjectSchemas(inputObjectTypes) {
    var _a, _b;
    for (let i = 0; i < inputObjectTypes.length; i += 1) {
        const fields = (_a = inputObjectTypes[i]) === null || _a === void 0 ? void 0 : _a.fields;
        const name = (_b = inputObjectTypes[i]) === null || _b === void 0 ? void 0 : _b.name;
        const transformer = new transformer_1.default({ name, fields: [...(fields || [])] });
        await transformer.generateObjectSchema();
    }
}
async function generateModelSchemas(models, modelOperations, aggregateOperationSupport) {
    const transformer = new transformer_1.default({
        models,
        modelOperations,
        aggregateOperationSupport,
    });
    await transformer.generateModelSchemas();
}
async function generateIndex() {
    await transformer_1.default.generateIndex();
}
//# sourceMappingURL=prisma-generator.js.map