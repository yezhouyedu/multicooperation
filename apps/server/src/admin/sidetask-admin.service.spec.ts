import { SideTaskAdminService } from './sidetask-admin.service';

describe('SideTaskAdminService V1.5.1 workbook compatibility', () => {
  const service = new SideTaskAdminService({} as never);

  it('normalizes bilingual headers to their English storage keys', () => {
    expect((service as any).normalizeHeader('内容子类\ncontent_subtype')).toBe('content_subtype');
    expect((service as any).normalizeHeader('题目编号\r\nitem_id')).toBe('item_id');
  });

  it('maps the 17-column workbook fields to existing database fields', () => {
    const item = (service as any).parseImportRow({
      item_id: 'OS-0001', work_segment: 1, text: '正文', question: '问题', option_a: '甲', option_b: '乙', gold_answer: 'A',
      evidence_span: '证据', pool_type: '普通中性池', content_theme: 'N', content_subtype: 'N1_entry_migration',
      question_type: 'MAT', business_scenario: '文档档案', narrative_category: '中性', text_form: 'record_notice', difficulty: 'L1',
    }, 2, 'V1.5.1');
    expect(item).toMatchObject({
      itemCode: 'OS-0001', eventArchetype: 'N', narrativeSubtype: 'N1_entry_migration',
      skeletonType: 'MAT', surfaceScenario: '文档档案', languageVariant: 'record_notice', version: 'V1.5.1',
    });
  });
});
