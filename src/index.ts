import * as fs from 'fs';
import * as path from 'path';
import { DetectedCall, KiroPowerConfig, DriftReport } from './types';
import { ConfigResolver } from './scanner/configResolver';
import { CSharpScanner, PythonScanner } from './scanner/scanner';
import { CdkGenerator } from './generator/cdkGenerator';
import { StackMerger } from './generator/merger';
import { DriftDetector } from './drift/driftDetector';

const DEFAULT_CONFIG: KiroPowerConfig = {
  version: '1.0.0',
  iac: {
    target: 'cdk-typescript',
    stackFile: 'infra/lib/app-stack.ts',
    defaultLambdaTarget: 'appFunction',
  },
  tagging: {
    enabled: true,
    tags: { ManagedBy: 'kiro-power:aws-auto-architect' },
  },
  scanner: {
    excludePaths: ['**/Tests/**', '**/*Test.cs', '**/*_test.py'],
    services: ['dynamodb', 's3', 'sqs', 'sns'],
  },
  security: {
    alertOnWildcards: true,
    requireEncryptionOnS3: true,
    alertOnDynamoDbScan: true,
  },
};

/** Conjunto de arquivos a ignorar no scan (testes, mocks, build) */
const IGNORE_PATTERNS = [
  '/Tests/',
  '/tests/',
  'Test.cs',
  'Tests.cs',
  '_test.py',
  '/test_',
  '/Mocks/',
  '/Fakes/',
  '/bin/',
  '/obj/',
  '/node_modules/',
];

/**
 * Orquestrador principal do Kiro Power.
 * Coordena o ciclo completo: scan → gerar IaC → mesclar na stack → verificar drift.
 */
export class KiroAutoArchitectPower {
  private readonly config: KiroPowerConfig;
  private readonly csharpScanner: CSharpScanner;
  private readonly pythonScanner: PythonScanner;
  private readonly cdkGenerator: CdkGenerator;

  constructor(private readonly workspaceRoot: string) {
    this.config = this.loadConfig();
    const configResolver = new ConfigResolver(workspaceRoot);
    this.csharpScanner = new CSharpScanner(configResolver);
    this.pythonScanner = new PythonScanner(configResolver);
    this.cdkGenerator = new CdkGenerator(this.config);
  }

  /** Escaneia todo o workspace e retorna as chamadas SDK detectadas */
  public scanWorkspace(): readonly DetectedCall[] {
    return this.collectSourceFiles(this.workspaceRoot).flatMap((file) =>
      this.scanFile(file)
    );
  }

  /** Gera o snippet CDK a partir das chamadas detectadas */
  public generateIaC(calls: readonly DetectedCall[]): string {
    return this.cdkGenerator.generate(calls);
  }

  /** Mescla o snippet gerado na stack CDK existente de forma não destrutiva */
  public mergeIntoStack(existingStackContent: string, calls: readonly DetectedCall[]): string {
    const snippet = this.generateIaC(calls);
    return StackMerger.merge(existingStackContent, snippet);
  }

  /** Detecta permissões IAM geradas que ficaram órfãs após mudanças no código */
  public checkDrift(existingStackContent: string, calls: readonly DetectedCall[]): DriftReport {
    return DriftDetector.detect(existingStackContent, calls);
  }

  private scanFile(filePath: string): readonly DetectedCall[] {
    const content = fs.readFileSync(filePath, 'utf8');
    if (filePath.endsWith('.cs')) return this.csharpScanner.scan(filePath, content);
    if (filePath.endsWith('.py')) return this.pythonScanner.scan(filePath, content);
    return [];
  }

  private collectSourceFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir).flatMap((entry) => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'bin', 'obj', 'dist'].includes(entry)) return [];
        return this.collectSourceFiles(fullPath);
      }

      if (!this.isSourceFile(fullPath) || this.isIgnored(fullPath)) return [];
      return [fullPath];
    });
  }

  private isSourceFile(filePath: string): boolean {
    return filePath.endsWith('.cs') || filePath.endsWith('.py');
  }

  private isIgnored(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return IGNORE_PATTERNS.some((pattern) => normalized.includes(pattern));
  }

  private loadConfig(): KiroPowerConfig {
    const configPath = path.join(this.workspaceRoot, 'kiro-power.json');
    if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;

    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } catch {
      console.warn('[KiroPower] kiro-power.json inválido, usando configuração padrão.');
      return DEFAULT_CONFIG;
    }
  }
}
