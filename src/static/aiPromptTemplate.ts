/**
 * AI 提示词相关的静态常量。
 * 独立成文件是为了让 configProvider（默认值）与 aiPromptService（运行时）都能引用，
 * 避免二者互相 import 造成循环依赖。
 */

/**
 * 用户可编辑的提示词模板默认值。
 * 仅包含"环境信息 + 用户输入 + 用户自定义要求"三部分，
 * 输出格式约束不在此处，由 OUTPUT_FORMAT_INSTRUCTION 硬编码追加，
 * 防止用户编辑模板时破坏 JSON 解析。
 */
export const DEFAULT_AI_PROMPT_TEMPLATE = `You are a terminal command assistant. Generate shell command suggestions for the user.

## Environment
Shell: \${shell}
System version: \${sysVersion}
Host: \${hostName}
Current directory: \${cwd}

## User input
\${cmd}

## Additional requirements from the user
\${customPrompt}
`;

/**
 * 输出格式约束。硬编码，不进入用户可编辑模板。
 * 接收期望条数，与 ai.inlineMaxCount 保持一致。
 */
export const outputFormatInstruction = (count: number): string => `
Respond with ONLY a JSON array wrapped in a markdown json code block, containing at most ${count} items.
Each item must have this exact shape:
- "command": the shell command itself
- "desp": a brief description of what the command does
- "dangerRating": an integer from 0 (very safe) to 5 (very dangerous)

Example:
\`\`\`json
[
  {
    "command": "<command>",
    "desp": "<brief description>",
    "dangerRating": 0
  }
]
\`\`\`
`;

/**
 * 附带最近终端输出时追加的说明段，让 AI 知道这段文本的来源。
 */
export const RECENT_OUTPUT_SECTION = (output: string): string => `
## Recent terminal output (may be truncated)
\`\`\`
${output}
\`\`\`
`;

/**
 * 预置环境标签的 id / name 列表。
 * 顺序即提示词拼接顺序。
 */
export const PRESET_ENV_TAG_NAMES: string[] = [
    'bash',
    'zsh',
    'fish',
    'sh',
    'powershell',
    'pwsh',
    'cmd',
    'git-bash',
    'wsl',
];

/**
 * 提示词模板支持的占位符清单，供设置页展示与预览时校验。
 */
export const AI_TEMPLATE_PLACEHOLDERS: string[] = [
    '${cmd}',
    '${sysVersion}',
    '${shell}',
    '${hostName}',
    '${customPrompt}',
    '${cwd}',
];
