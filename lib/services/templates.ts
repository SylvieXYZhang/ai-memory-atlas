// Template rendering for different content formats
// Adapted for global market: Social Post, Blog Article, Professional Report

import type { TemplateData, TemplateType } from '../types'
import { extractTopic } from '../voice-utils'

/**
 * Generate content for Social Post format
 * Engaging, concise, shareable format suitable for LinkedIn, Twitter, etc.
 */
function renderSocialPost(data: TemplateData): string {
  const topic = extractTopic(data.topic)
  const research = data.research
  
  let content = `# ${topic}\n\n`
  content += `## Quick Take\n\n`
  content += `${data.summary}\n\n`
  
  if (research) {
    content += `---\n\n`
    content += `## Key Insights\n\n`
    
    if (research.trends.length > 0) {
      research.trends.slice(0, 4).forEach((trend, i) => {
        content += `${i + 1}. **${trend}**\n`
      })
      content += `\n`
    }
    
    if (research.keyPlayers.length > 0) {
      content += `## Who to Watch\n\n`
      content += research.keyPlayers.slice(0, 5).join(' | ') + `\n\n`
    }
    
    content += `---\n\n`
    content += `## The Bottom Line\n\n`
    content += `${research.conclusion.split('\n')[0]}\n\n`
    
    content += `---\n\n`
    content += `*Share your thoughts below! What trends are you seeing?*\n\n`
    content += `#${topic.replace(/\s+/g, '')} #Innovation #Industry #Trends`
  }
  
  return content
}

/**
 * Generate content for Blog Article format
 * Professional, well-structured long-form content
 */
function renderBlogArticle(data: TemplateData): string {
  const topic = extractTopic(data.topic)
  const research = data.research
  
  let content = `# ${topic}: A Comprehensive Analysis\n\n`
  content += `*Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*\n\n`
  
  content += `## Executive Summary\n\n`
  content += `${data.summary}\n\n`
  
  if (research) {
    content += `---\n\n`
    
    content += `## Market Overview\n\n`
    content += `${research.marketOverview}\n\n`
    
    if (research.keyPlayers.length > 0) {
      content += `## Key Players\n\n`
      content += `The following organizations and entities are shaping this space:\n\n`
      research.keyPlayers.forEach(player => {
        content += `- **${player}**\n`
      })
      content += `\n`
    }
    
    if (research.trends.length > 0) {
      content += `## Current Trends\n\n`
      content += `Several key trends are defining the landscape:\n\n`
      research.trends.forEach((trend, i) => {
        content += `### ${i + 1}. ${trend}\n\n`
      })
    }
    
    content += `## Strategic Outlook\n\n`
    content += `${research.conclusion}\n\n`
    
    if (research.sources.length > 0) {
      content += `---\n\n`
      content += `## References\n\n`
      research.sources.forEach((source, i) => {
        content += `${i + 1}. ${source}\n`
      })
      content += `\n`
    }
  }
  
  content += `---\n\n`
  content += `*This analysis was generated using VoiceAgent AI research tools.*`
  
  return content
}

/**
 * Generate content for Professional Report format
 * Formal, detailed, suitable for business presentations
 */
function renderProfessionalReport(data: TemplateData): string {
  const topic = extractTopic(data.topic)
  const research = data.research
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  
  let content = `# RESEARCH REPORT\n\n`
  content += `## ${topic}\n\n`
  content += `**Report Date:** ${date}\n\n`
  content += `**Classification:** General Distribution\n\n`
  
  content += `---\n\n`
  
  content += `## TABLE OF CONTENTS\n\n`
  content += `1. Executive Summary\n`
  content += `2. Market Analysis\n`
  content += `3. Competitive Landscape\n`
  content += `4. Trend Analysis\n`
  content += `5. Strategic Recommendations\n`
  content += `6. Appendix\n\n`
  
  content += `---\n\n`
  
  content += `## 1. EXECUTIVE SUMMARY\n\n`
  content += `${data.summary}\n\n`
  
  if (research) {
    content += `---\n\n`
    
    content += `## 2. MARKET ANALYSIS\n\n`
    content += `${research.marketOverview}\n\n`
    
    if (research.keyPlayers.length > 0) {
      content += `---\n\n`
      content += `## 3. COMPETITIVE LANDSCAPE\n\n`
      content += `### Key Market Participants\n\n`
      content += `| Entity | Significance |\n`
      content += `|--------|-------------|\n`
      research.keyPlayers.forEach(player => {
        content += `| ${player} | Market Leader |\n`
      })
      content += `\n`
    }
    
    if (research.trends.length > 0) {
      content += `---\n\n`
      content += `## 4. TREND ANALYSIS\n\n`
      research.trends.forEach((trend, i) => {
        content += `### 4.${i + 1} ${trend}\n\n`
        content += `*Analysis pending detailed market data.*\n\n`
      })
    }
    
    content += `---\n\n`
    content += `## 5. STRATEGIC RECOMMENDATIONS\n\n`
    content += `${research.conclusion}\n\n`
    
    content += `### Recommendations by Stakeholder\n\n`
    content += `**For Executives:**\n`
    content += `- Prioritize investment in emerging technologies\n`
    content += `- Develop strategic partnerships with key players\n`
    content += `- Monitor regulatory developments closely\n\n`
    
    content += `**For Product Teams:**\n`
    content += `- Focus on user experience and accessibility\n`
    content += `- Implement agile development methodologies\n`
    content += `- Build for scalability from day one\n\n`
    
    content += `**For Investors:**\n`
    content += `- Consider diversified portfolio approach\n`
    content += `- Track early-stage innovations\n`
    content += `- Evaluate long-term growth potential\n\n`
    
    if (research.sources.length > 0) {
      content += `---\n\n`
      content += `## 6. APPENDIX\n\n`
      content += `### A. Sources and References\n\n`
      research.sources.forEach((source, i) => {
        content += `[${i + 1}] ${source}\n`
      })
      content += `\n`
    }
  }
  
  content += `---\n\n`
  content += `*Report generated by VoiceAgent | Confidential*`
  
  return content
}

/**
 * Render content based on template type
 */
export function renderTemplate(data: TemplateData, type: TemplateType): string {
  switch (type) {
    case 'social':
      return renderSocialPost(data)
    case 'blog':
      return renderBlogArticle(data)
    case 'report':
      return renderProfessionalReport(data)
    default:
      return renderSocialPost(data)
  }
}

/**
 * Get template display name
 */
export function getTemplateDisplayName(type: TemplateType): string {
  switch (type) {
    case 'social':
      return 'Social Post'
    case 'blog':
      return 'Blog Article'
    case 'report':
      return 'Professional Report'
    default:
      return 'Unknown'
  }
}

/**
 * Get all available template types
 */
export function getTemplateTypes(): TemplateType[] {
  return ['social', 'blog', 'report']
}
