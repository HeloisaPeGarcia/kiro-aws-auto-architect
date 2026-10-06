import * as fs from 'fs';
import * as path from 'path';

type ConfigMap = Readonly<Record<string, string>>;


export class ConfigResolver {
  private readonly configMap: ConfigMap;

  constructor(workspaceRoot: string) {
    this.configMap = {
      ...this.readDotEnv(workspaceRoot),
      ...this.readAppSettings(workspaceRoot),
    };
  }


  public resolve(key: string): string | undefined {
    const normalized = this.normalizeKey(key);

    const directMatch = this.configMap[normalized];
    if (directMatch) return directMatch;

    // Busca case-insensitive como fallback
    const lowerKey = normalized.toLowerCase();
    return Object.entries(this.configMap).find(
      ([k]) => k.toLowerCase() === lowerKey
    )?.[1];
  }

  private normalizeKey(raw: string): string {
    // Remove caracteres de acesso de código: aspas, colchetes, cifrão
    return raw.replace(/["'\[\]${}]/g, '').trim();
  }

  private readDotEnv(root: string): Record<string, string> {
    const envPath = path.join(root, '.env');
    if (!fs.existsSync(envPath)) return {};

    return fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .reduce<Record<string, string>>((acc, line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return acc;

        const separatorIndex = trimmed.indexOf('=');
        const key = trimmed.substring(0, separatorIndex).trim();
        const value = trimmed.substring(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

        if (key) acc[key] = value;
        return acc;
      }, {});
  }

  private readAppSettings(root: string): Record<string, string> {
    const settingsPath = path.join(root, 'appsettings.json');
    if (!fs.existsSync(settingsPath)) return {};

    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return this.flattenJson(parsed);
    } catch {
      return {};
    }
  }

  private flattenJson(obj: unknown, prefix = ''): Record<string, string> {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};

    return Object.entries(obj as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const fullKey = prefix ? `${prefix}:${key}` : key;
        if (typeof value === 'string' || typeof value === 'number') {
          acc[fullKey] = String(value);
          acc[key] = String(value); // também indexa pela chave simples
        } else if (typeof value === 'object' && value !== null) {
          Object.assign(acc, this.flattenJson(value, fullKey));
        }
        return acc;
      },
      {}
    );
  }
}
