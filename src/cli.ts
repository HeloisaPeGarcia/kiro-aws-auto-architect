#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { KiroAutoArchitectPower } from './index';
import { DetectedCall, DriftReport } from './types';

function printHeader(): void {
  console.log('🌩️  Kiro Power: AWS Serverless & Infrastructure Auto-Architect (v1.0.0)');
  console.log('═'.repeat(72));
}

function printUsage(): void {
  printHeader();
  console.log(`
Usage:
  auto-architect <command> [options]

Commands:
  scan       Scan workspace for AWS SDK calls (.NET C# and Python)
  generate   Generate least-privilege AWS CDK (TypeScript) snippet
  apply      Synthesize and merge CDK code into the configured target stack
  drift      Detect orphaned IAM permissions in the target CDK stack

Options:
  --dir <path>     Workspace directory (default: current working directory)
  --stack <path>   Target CDK stack file (overrides kiro-power.json setting)
  --json           Output raw JSON instead of human-readable formatting
  --help, -h       Display this help message
  --version, -v    Display version number
  `);
}

function resolveWorkspace(args: string[]): {
  command: string;
  workspaceDir: string;
  customStackFile?: string;
  isJson: boolean;
} {
  const flags = args.slice(2);
  const command = flags[0] && !flags[0].startsWith('-') ? flags[0] : 'help';

  let workspaceDir = process.cwd();
  let customStackFile: string | undefined;
  let isJson = false;

  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--dir' && flags[i + 1]) {
      workspaceDir = path.resolve(flags[i + 1]);
      i++;
    } else if (flags[i] === '--stack' && flags[i + 1]) {
      customStackFile = path.resolve(flags[i + 1]);
      i++;
    } else if (flags[i] === '--json') {
      isJson = true;
    } else if (flags[i] === '--help' || flags[i] === '-h') {
      return { command: 'help', workspaceDir, isJson };
    } else if (flags[i] === '--version' || flags[i] === '-v') {
      return { command: 'version', workspaceDir, isJson };
    }
  }

  return { command, workspaceDir, customStackFile, isJson };
}

function getStackFilePath(workspaceDir: string, customStackFile?: string): string {
  if (customStackFile) return customStackFile;

  const configPath = path.join(workspaceDir, 'kiro-power.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.iac?.stackFile) {
        return path.resolve(workspaceDir, config.iac.stackFile);
      }
    } catch {
      // Ignore config parse error, fallback to default
    }
  }

  // Fallbacks: examples/AppStack.ts or infra/lib/app-stack.ts
  const exampleStack = path.join(workspaceDir, 'examples', 'AppStack.ts');
  if (fs.existsSync(exampleStack)) return exampleStack;

  return path.join(workspaceDir, 'infra', 'lib', 'app-stack.ts');
}

function formatScanResults(calls: readonly DetectedCall[]): void {
  const activeCalls = calls.filter((c) => !c.isIgnored);
  const ignoredCalls = calls.filter((c) => c.isIgnored);

  console.log(`\n🔍 Found ${activeCalls.length} active AWS SDK call(s) (${ignoredCalls.length} suppressed):\n`);

  if (activeCalls.length === 0) {
    console.log('   No unmapped AWS SDK calls found.');
    return;
  }

  console.log('┌' + '─'.repeat(22) + '┬' + '─'.repeat(12) + '┬' + '─'.repeat(26) + '┬' + '─'.repeat(20) + '┐');
  console.log('│ File (Line)          │ Service    │ IAM Actions                │ Resource Name        │');
  console.log('├' + '─'.repeat(22) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(26) + '┼' + '─'.repeat(20) + '┤');

  for (const call of activeCalls) {
    const fileLabel = `${path.basename(call.file)}:${call.lineNumber}`.padEnd(20);
    const serviceLabel = call.service.toUpperCase().padEnd(10);
    const actionsLabel = call.iamActions.join(', ').slice(0, 24).padEnd(24);
    const resourceLabel = (call.resolvedResourceName || call.resourceNameOrVariable).slice(0, 18).padEnd(18);

    console.log(`│ ${fileLabel} │ ${serviceLabel} │ ${actionsLabel} │ ${resourceLabel} │`);

    if (call.warning) {
      console.log(`│ ⚠️  Warning: ${call.warning.padEnd(76)}│`);
    }
  }

  console.log('└' + '─'.repeat(22) + '┴' + '─'.repeat(12) + '┴' + '─'.repeat(26) + '┴' + '─'.repeat(20) + '┘');
}

function formatDriftReport(report: DriftReport): void {
  console.log('\n📊 Drift Detection Report');
  console.log(`   Active in-code permissions: ${report.activePermissionsCount}`);
  console.log(`   Orphaned stack permissions: ${report.orphanPermissions.length}\n`);

  if (report.orphanPermissions.length === 0) {
    console.log('✅ Clean! No orphaned IAM permissions detected in the target stack.');
    return;
  }

  console.log('⚠️  The following IAM permissions exist in CDK but have NO matching active code calls:');
  for (const orphan of report.orphanPermissions) {
    console.log(`   • [${orphan.service.toUpperCase()}] ${orphan.action} on "${orphan.resource}" (${orphan.reason})`);
  }
  console.log('\n💡 Recommendation: Run "auto-architect apply" to synchronize your CDK stack.');
}

function main(): void {
  const { command, workspaceDir, customStackFile, isJson } = resolveWorkspace(process.argv);

  if (command === 'help' || !command) {
    printUsage();
    process.exit(0);
  }

  if (command === 'version') {
    console.log('v1.0.0');
    process.exit(0);
  }

  const power = new KiroAutoArchitectPower(workspaceDir);

  switch (command) {
    case 'scan': {
      const calls = power.scanWorkspace();
      if (isJson) {
        console.log(JSON.stringify(calls, null, 2));
      } else {
        printHeader();
        formatScanResults(calls);
      }
      break;
    }

    case 'generate': {
      const calls = power.scanWorkspace();
      const snippet = power.generateIaC(calls);
      if (isJson) {
        console.log(JSON.stringify({ snippet, callsCount: calls.length }, null, 2));
      } else {
        printHeader();
        console.log('\n📦 Generated AWS CDK TypeScript Snippet:\n');
        console.log(snippet);
      }
      break;
    }

    case 'apply': {
      const stackFile = getStackFilePath(workspaceDir, customStackFile);
      if (!fs.existsSync(stackFile)) {
        console.error(`❌ Target stack file not found: ${stackFile}`);
        process.exit(1);
      }

      const existingContent = fs.readFileSync(stackFile, 'utf8');
      const calls = power.scanWorkspace();
      const updatedContent = power.mergeIntoStack(existingContent, calls);

      fs.writeFileSync(stackFile, updatedContent, 'utf8');

      if (isJson) {
        console.log(JSON.stringify({ success: true, stackFile, mergedCalls: calls.length }));
      } else {
        printHeader();
        console.log(`✅ Successfully synthesized and merged IAM permissions into:`);
        console.log(`   📄 ${stackFile}`);
        console.log(`   ✨ Updated constructs with least privilege IAM rules.`);
      }
      break;
    }

    case 'drift': {
      const stackFile = getStackFilePath(workspaceDir, customStackFile);
      if (!fs.existsSync(stackFile)) {
        console.error(`❌ Target stack file not found: ${stackFile}`);
        process.exit(1);
      }

      const existingContent = fs.readFileSync(stackFile, 'utf8');
      const calls = power.scanWorkspace();
      const report = power.checkDrift(existingContent, calls);

      if (isJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printHeader();
        formatDriftReport(report);
      }

      if (report.orphanPermissions.length > 0) {
        process.exitCode = 1;
      }
      break;
    }

    default:
      console.error(`Unknown command: "${command}". Run "auto-architect --help" for available commands.`);
      process.exit(1);
  }
}

main();
