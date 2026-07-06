export type PromptPurpose = 'tool' | 'knowledge' | 'thinking'

export type MemoryRepresentation = 'markdown' | 'knowledge_graph' | 'thinking_map'

export interface PromptClassification {
  purpose: PromptPurpose
  representation: MemoryRepresentation
  confidence: number
  rationale: string
  boundarySignals: string[]
}

const toolPatterns = [
  /\b(write|rewrite|polish|edit|translate|summarize|format|draft|compose|generate|create|make|output|export)\b/i,
  /\b(email|cover letter|image|picture|slides?|table|json|csv|copy|template)\b/i,
  /写|改写|润色|翻译|总结|整理成|输出|生成|画一张|做一张|邮件|文案|格式|表格|图片/,
]

const knowledgePatterns = [
  /\b(what is|how does|research|investigate|explain|overview|architecture|theory|theories|compare|survey|learn)\b/i,
  /是什么|为什么|如何理解|解释|调研|搜索|查找|检索|理论|架构|资料|文献|综述|对比|学习/,
]

const thinkingPatterns = [
  /\b(think with me|brainstorm|critique|evaluate my idea|reflect|strategy|framework|hypothesis|assumption|values|cognitive|boundary)\b/i,
  /进一步思考|一起思考|共生思考|脑暴|评判|反驳|我的想法|这个逻辑|框架|假设|价值观|认知|知识边界|边界|策略|产品方向|建议/,
]

const thinkingSignalPatterns: Array<[RegExp, string]> = [
  [/\b(framework|model|taxonomy)\b/i, 'framework-building'],
  [/框架|分类|模型/, 'framework-building'],
  [/\b(assumption|hypothesis)\b/i, 'assumption-testing'],
  [/假设|前提/, 'assumption-testing'],
  [/\b(values?|principles?)\b/i, 'values-and-principles'],
  [/价值观|原则|判断标准/, 'values-and-principles'],
  [/\b(boundary|frontier|edge)\b/i, 'knowledge-boundary'],
  [/知识边界|边界|未知|不确定/, 'knowledge-boundary'],
  [/\b(critique|tradeoff|risk)\b/i, 'critical-evaluation'],
  [/评判|反驳|风险|取舍|盲点/, 'critical-evaluation'],
]

function score(text: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

export function classifyPromptPurpose(input?: string, output?: string): PromptClassification {
  const prompt = input?.trim() || ''
  const response = output?.trim() || ''
  const text = `${prompt}\n${response.slice(0, 1200)}`
  const promptOnly = prompt || response

  const toolScore = score(promptOnly, toolPatterns)
  const knowledgeScore = score(promptOnly, knowledgePatterns)
  const thinkingScore = score(text, thinkingPatterns)

  const boundarySignals = unique(
    thinkingSignalPatterns
      .filter(([pattern]) => pattern.test(text))
      .map(([, signal]) => signal),
  )

  if (thinkingScore > 0 && thinkingScore >= knowledgeScore) {
    return {
      purpose: 'thinking',
      representation: 'thinking_map',
      confidence: Math.min(0.94, 0.68 + thinkingScore * 0.08 + boundarySignals.length * 0.03),
      rationale: 'The exchange exposes a user framework, assumptions, values, or a growing cognitive boundary.',
      boundarySignals,
    }
  }

  if (knowledgeScore > 0 && knowledgeScore >= toolScore) {
    return {
      purpose: 'knowledge',
      representation: 'knowledge_graph',
      confidence: Math.min(0.9, 0.66 + knowledgeScore * 0.08),
      rationale: 'The exchange asks AI to retrieve, explain, compare, or structure external knowledge.',
      boundarySignals: boundarySignals.length ? boundarySignals : ['knowledge-gap'],
    }
  }

  if (toolScore > 0) {
    return {
      purpose: 'tool',
      representation: 'markdown',
      confidence: Math.min(0.88, 0.64 + toolScore * 0.08),
      rationale: 'The exchange is primarily asking AI to produce or transform a concrete artifact.',
      boundarySignals: ['result-preference'],
    }
  }

  return {
    purpose: 'thinking',
    representation: 'thinking_map',
    confidence: 0.52,
    rationale: 'Defaulting ambiguous AI conversations toward thinking memory so the user can review before graph promotion.',
    boundarySignals: ['ambiguous-reflection'],
  }
}

export function shouldEnterGraph(classification: Partial<Pick<PromptClassification, 'purpose'>> & { promptPurpose?: PromptPurpose }) {
  const purpose = classification.purpose || classification.promptPurpose
  return purpose !== 'tool'
}
