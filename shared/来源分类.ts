import type { SourceRecord, SourceType, CredibilityTier } from './证据领域模型.js';

type Classifiable = SourceRecord & { extractedText?: string };

export function classifySourceRecord(source: Classifiable, at = new Date().toISOString()): SourceRecord {
  const text = `${source.title} ${source.publisher || ''} ${source.url || ''} ${source.shortSummary} ${source.extractedText || ''}`;
  let sourceType: SourceType = 'unknown';
  let credibilityTier: CredibilityTier = 'unrated';
  let reason = '材料类型不足，等待用户确认。';

  if (source.isLikelyRepost || /转载自|转自/u.test(text)) {
    sourceType = 'repost'; credibilityTier = 'C'; reason = '检测到转载关系或转载说明。';
  } else if (/社交|微博|论坛|帖子|匿名|截图/u.test(text)) {
    sourceType = 'social_post'; credibilityTier = 'lead_only'; reason = '社交或匿名内容只能作为线索。';
  } else if (/优惠|购买|产品宣传|业内领先|广告|推广/u.test(text)) {
    sourceType = 'commercial_content'; credibilityTier = 'C'; reason = '内容具有商业推广特征。';
  } else if (/统计局|数据集|统计数据|开放数据/u.test(text)) {
    sourceType = 'official_data'; credibilityTier = 'A'; reason = '识别为原始官方数据。';
  } else if (/正式通知|办法|条例|政策原文|管理规定|法院文件/u.test(text) && /教务处|学校|政府|委员会|法院|\.edu|\.gov/iu.test(text)) {
    sourceType = 'primary_document'; credibilityTier = 'A'; reason = '识别为当事机构发布的正式原始文件。';
  } else if (/正式声明|新闻发布|情况说明/u.test(text)) {
    sourceType = 'official_statement'; credibilityTier = 'A'; reason = '识别为当事机构正式说明；只证明其公开表述。';
  } else if (/doi|期刊|论文|同行评审|研究报告/iu.test(text)) {
    sourceType = 'academic_source'; credibilityTier = 'B'; reason = '识别为学术或专业研究材料。';
  } else if (/记者|采访|报道|日报|新闻/u.test(text)) {
    sourceType = 'news_report'; credibilityTier = 'B'; reason = '识别为可能包含独立采访的新闻报道，仍需核对方法与原始来源。';
  } else if (!source.url) {
    sourceType = 'user_material'; credibilityTier = 'unrated'; reason = '用户材料不自动获得 A 级，等待确认材料性质。';
  }
  return {
    ...source,
    sourceType,
    credibilityTier,
    classificationHistory: [
      ...source.classificationHistory,
      { at, actor: 'rules', sourceType, credibilityTier, reason },
    ],
  };
}

export function overrideSourceClassification(
  source: SourceRecord,
  sourceType: SourceType,
  credibilityTier: CredibilityTier,
  reason: string,
  at = new Date().toISOString(),
): SourceRecord {
  if (!reason.trim()) throw new Error('修改来源分类时必须记录理由。');
  return {
    ...source,
    sourceType,
    credibilityTier,
    classificationHistory: [...source.classificationHistory, {
      at, actor: 'user', sourceType, credibilityTier, reason: reason.trim(),
    }],
  };
}
