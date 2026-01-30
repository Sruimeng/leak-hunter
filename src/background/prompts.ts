import type { UuidLeakCandidate } from '../types'
import type { SourceContext } from '../types/ai'

export const ANALYSIS_SYSTEM_PROMPT = `你是 Three.js 内存泄漏分析专家。根据提供的对象 Diff 数据，判断哪些对象属于'应该销毁但未销毁'的残留物。忽略 Vue 的内部对象。直接返回泄漏对象的名称列表和简短建议。

返回格式（JSON）：
{
  "leaks": ["对象名1", "对象名2"],
  "severity": "high" | "medium" | "low",
  "recommendations": ["建议1", "建议2"]
}`

export const buildFixPrompt = (
  leak: UuidLeakCandidate,
  context: SourceContext | null
): string => {
  const componentInfo = leak.component ? `组件: ${leak.component}` : '组件: 未知'
  const ageInfo = `存活时长: ${(leak.age / 1000).toFixed(1)}s`

  const stackSection = leak.descriptor.stack.length > 0
    ? `分配栈:\n${leak.descriptor.stack.slice(0, 3).join('\n')}`
    : '分配栈: 无'

  const sourceSection = context
    ? `源码位置 (${context.file}:${context.line}):\n${context.snippet}`
    : '源码: 无法获取'

  return `检测到组件已卸载，但 THREE.${leak.descriptor.type} [uuid: ${leak.uuid}] 未被释放。

${componentInfo}
${ageInfo}

${stackSection}

${sourceSection}

请生成基于 \`onBeforeUnmount\` 的清理代码，包含:
1. geometry.dispose()
2. material.dispose()
3. texture.dispose()

要求:
- 最多30行
- 使用早返回模式
- 类型安全
- 无注释（类型说明即可）`.trim()
}

export const buildAnalysisPrompt = (leaks: UuidLeakCandidate[]): string => {
  const summary = leaks.map(l =>
    `- ${l.descriptor.type} [${l.uuid.slice(0, 8)}] 存活 ${(l.age / 1000).toFixed(1)}s`
  ).join('\n')

  return `检测到 ${leaks.length} 个潜在泄漏:

${summary}

请按严重程度排序并给出修复优先级。输出JSON格式:
{
  "critical": ["uuid1", "uuid2"],
  "warning": ["uuid3"],
  "info": ["uuid4"]
}`.trim()
}
