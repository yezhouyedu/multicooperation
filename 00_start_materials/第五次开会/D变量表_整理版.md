# 人机协作实验后台变量表

## 一、变量表总说明：后台需要记录哪几类数据

本实验后台数据分为 12 类：

| 类别 | 数据名称 | 主要用途 |
|------|----------|----------|
| 1 | 实验配置与随机化数据 | 记录三章处理组、slot、随机区组、A/B 角色、叙事主题顺序、新闻顺序等 |
| 2 | 参与者、到场、匹配与团队数据 | 处理 no-show、迟到、替补、随机匹配、A/B 角色分配和异常样本 |
| 3 | 公司、材料与金标准数据 | 记录公司、材料分配、材料类型、标准事实、标准机会/风险、标准建议 |
| 4 | 公司流转与推送机制数据 | 记录 A 锁定、公司池、B 接收、B_PreA、A 输出解锁、B 提交、空窗或预启动 |
| 5 | A 端填写数据 | 记录 A.1 基础数值摘录、A.2 材料线索记录、A.3 总体交接备注 |
| 6 | B 端填写数据 | 记录 B_PreA 快照、最终信息点、来源、综合判断、最终建议、反馈 |
| 7 | AI 使用日志 | 记录主线 AI、副线 AI 的 prompt、response、请求时间、返回时间、AI 能力状态和上下文权限 |
| 8 | 行为事件日志 | 记录点击、查看、滚动、输入、复制、粘贴、切换、失焦、提交等事件 |
| 9 | 副线任务数据 | 记录副线释放、打开、提交、答案、得分、批处理和副线 AI 使用 |
| 10 | 叙事暴露与问卷数据 | 记录合作叙事/中性信息展示、阅读时长、工作段问卷和实验后问卷 |
| 11 | 评分与论文变量数据 | 记录 A、B、团队、副线的评分结果，以及三章论文中使用的派生变量 |
| 12 | 数据质量与异常标记 | 记录断线、迟到、队友退出、晚提交、AI 超时、来源不一致、多标签页等质量 flag |

随机化处理说明已经明确：三章处理均随机到团队层面；预报名名单不直接参与随机化；实际到场并登录后才进入匹配池；同一启动批次内随机匹配为团队；team_id 形成后随机分配 A/B，再领取隐藏 treatment slot。材料分配、新闻顺序和公司推送机制都要记录，但它们不是三章的主处理变量。

---

## 二、通用主键与命名规范

所有核心表建议至少保留以下通用字段：

| 字段名 | 含义 |
|--------|------|
| `session_id` | 实验场次 |
| `experiment_chapter` | 实验局：1=AI 能力升级；2=副线到达节奏；3=合作叙事 |
| `team_id` | 团队 ID |
| `participant_id` | 参与者 ID |
| `role` | A / B |
| `company_id` | 公司 ID |
| `team_company_id` | 团队—公司 ID |
| `work_segment` | 工作段：1 / 2 / 3 |
| `window_stage` | A_window / B_PreA / B_PostA / side |
| `server_time` | 服务器时间 |
| `client_time` | 客户端时间，可用于排查 |
| `event_id` | 事件 ID，如适用 |
| `version` | 配置、材料、评分或问卷版本 |

命名建议：

| 类型 | 命名 |
|------|------|
| 原始后台字段 | snake_case，例如 `assignment_time_server` |
| 论文变量 | 保留文档已有 CamelCase，例如 `Completed`, `RealizedOutput`, `ViewA` |
| 章节处理变量 | 使用文档已有处理名，例如 `early_upgrade`, `late_upgrade`, `batch`, `continuous`, `coop_narrative`, `neutral_info` |
| 派生变量 | 不要求前端实时计算，建议由研究者脚本生成 |

---

# 三、各类数据与变量表

## 1. 实验配置与随机化数据

### 1.1 `experiment_session`

记录每场实验的固定配置。

| 字段 | 含义 |
|------|------|
| `session_id` | 实验场次 |
| `experiment_chapter` | 实验局编号 |
| `session_date` | 实验日期 |
| `config_version` | 配置版本 |
| `A_window_minutes` | A 单家公司处理窗口 |
| `B_preA_minutes` | B 收到 A 前独立处理窗口 |
| `work_segment_minutes` | 工作段长度 |
| `source_required` | B 信息点来源是否必填 |
| `B_submit_requires_A_open` | 固定为 false，B 可不查看 A 提交 |
| `side_dispatch_mode` | continuous / batch |
| `side_retention_policy` | 副线段内保留、段末归档 |
| `side_prompt_show_pending_count` | 固定为 false |
| `ai_capability_version` | basic / upgraded |
| `ai_can_process_images` | AI 是否可处理图片 |
| `ai_model_version` | AI 模型版本 |
| `main_ai_context_scope` | 主线 AI 上下文范围，通常为 company |
| `side_ai_context_scope` | 副线 AI 上下文范围，通常为 work_segment |
| `narrative_version` | 叙事材料版本 |
| `questionnaire_version` | 问卷版本 |
| `scoring_version` | 评分版本 |

说明：这里不再拆分 `ai_image_upload_enabled`、`ai_ocr_enabled`、`ai_vision_qa_enabled`。当前实验中只有"AI 能处理图片"和"AI 不能处理图片"两种能力状态，因此统一记为 `ai_can_process_images`。模型能力单独用 `ai_model_version` 或 `ai_capability_version` 记录。

### 1.2 `randomization_audit`

记录所有与随机化有关的审计字段。

| 字段 | 含义 |
|------|------|
| `audit_id` | 随机化审计记录编号 |
| `registered_id_A` | A 的预报名编号，可空 |
| `registered_id_B` | B 的预报名编号，可空 |
| `participant_A_id` | A 参与者编号 |
| `participant_B_id` | B 参与者编号 |
| `session_id` | 实验场次 |
| `arrival_batch_id` | 启动批次 |
| `matching_pool_id` | 匹配池 |
| `team_id` | 团队编号 |
| `pairing_seed` | 参与者匹配随机种子 |
| `role_assignment_seed` | A/B 角色随机种子 |
| `role_assignment_time` | 角色分配时间 |
| `experiment_chapter` | 实验局 |
| `treatment_assignment` | 团队处理状态 |
| `slot_id` | 隐藏 treatment slot |
| `randomization_block` | 场次内随机区组 |
| `assignment_time_server` | 处理分配时间 |
| `randomizer_version` | 随机化服务版本 |
| `no_show_flag` | 是否 no-show，仅预报名层 |
| `standby_flag` | 是否替补 |
| `late_arrival_flag` | 是否迟到 |
| `team_void_before_formal` | 正式实验前是否作废 |
| `partner_dropout` | 正式实验后是否队友退出 |
| `manual_override_flag` | 是否人工覆盖，原则上 false |
| `manual_override_reason` | 覆盖原因，可空 |

处理 slot 只在 team_id 形成后消耗；no-show、未成功匹配者和正式实验前作废团队不应正常占用正式样本 slot。

### 1.3 三章处理变量

| 实验局 | 后台字段 | 允许值 | 说明 |
|--------|----------|--------|------|
| 第一章 | `treatment_assignment` | `early_upgrade` / `late_upgrade` | 错位升级队列 |
| 第一章 | `upgrade_cohort` | `early_upgrade` / `late_upgrade` | 与上同，可作为更直观别名 |
| 第一章 | `segment_1_ai_state` | basic | 所有团队段 1 基础版 |
| 第一章 | `segment_2_ai_state` | basic / upgraded | early 已升级，late 未升级 |
| 第一章 | `segment_3_ai_state` | upgraded | 所有团队最终升级 |
| 第二章 | `treatment_assignment` | `continuous` / `batch` | 副线到达节奏 |
| 第二章 | `Batch` | 0 / 1 | 论文变量；batch=1，continuous=0 |
| 第三章 | `treatment_assignment` | `coop_narrative` / `neutral_info` | 合作叙事 vs 中性信息 |
| 第三章 | `CoopNarr` | 0 / 1 | 论文变量；合作叙事=1 |
| 第三章 | `theme_order` | `T1_T2_T3` 等六种 | 合作叙事组三主题顺序 |
| 第三章 | `narrative_theme_segment_1` | T1 / T2 / T3 / neutral | 段 1 主题 |
| 第三章 | `narrative_theme_segment_2` | T1 / T2 / T3 / neutral | 段 2 主题 |
| 第三章 | `narrative_theme_segment_3` | T1 / T2 / T3 / neutral | 段 3 主题 |

第一章是早升级/晚升级的错位升级设计；第二章整局固定为 batch 或 continuous；第三章整局固定为合作叙事或中性信息，合作叙事组内部还要随机三类主题顺序。

---

## 2. 参与者、到场、匹配与团队数据

### 2.1 `participant`

| 字段 | 含义 |
|------|------|
| `participant_id` | 正式参与者编号 |
| `registered_id` | 预报名编号，可空 |
| `session_id` | 实验场次 |
| `check_in_time` | 现场签到时间 |
| `login_time` | 平台登录时间 |
| `terminal_id` | 终端或座位编号 |
| `arrival_batch_id` | 启动批次 |
| `standby_flag` | 是否替补 |
| `late_arrival_flag` | 是否迟到 |
| `test_round_completed` | 测试轮是否完成 |
| `test_required_action_completed` | 测试轮关键操作是否完成 |
| `dropout_flag` | 是否退出 |
| `dropout_time` | 退出时间 |
| `technical_failure_flag` | 是否技术故障 |

### 2.2 `team_roster`

| 字段 | 含义 |
|------|------|
| `team_id` | 团队编号 |
| `participant_id` | 参与者编号 |
| `role` | A / B |
| `partner_id` | 队友编号 |
| `role_assignment_seed` | 角色随机种子 |
| `role_assignment_time` | 角色分配时间 |

---

## 3. 公司、材料与金标准数据

### 3.1 `company_master`

| 字段 | 含义 |
|------|------|
| `company_id` | 公司编号 |
| `company_code` | 前台显示编号 |
| `industry` | 行业 |
| `business_summary` | 业务简介 |
| `company_version` | 公司材料版本 |
| `material_assignment_pattern` | `A_macro_B_micro` / `A_micro_B_macro` |
| `A_material_attribute` | macro / micro |
| `B_material_attribute` | macro / micro |
| `gold_recommendation` | 标准投资建议 |
| `AInfoPivotal` | A 端信息是否足以改变仅看 B 材料时的投资方向 |
| `BPreA_sufficiency` | B 仅凭自有材料是否足以推出正确投资方向 |
| `BReport_sufficiency` | B 自有材料是否足以支撑高质量报告 |
| `AResidualValue` | A 输出在 B 已有信息之外的边际价值 |
| `AExclusiveVetoRisk` | A 是否独占一票否决风险 |
| `IntegrationDemand` | 公司任务对 A/B 整合的需求程度 |
| `AIWaitExposure` | 公司层面潜在 AI 等待暴露度 |

公司材料分配是公司层面的预设随机化，不是团队层面的处理变量；每家公司一旦设定为 `A_macro_B_micro` 或 `A_micro_B_macro`，在所有团队中保持一致。

### 3.2 `material_source`

| 字段 | 含义 |
|------|------|
| `material_id` | 材料编号 |
| `company_id` | 公司编号 |
| `material_slot` | M01-M11 |
| `front_display_no` | 前台材料编号 |
| `material_attribute` | 微观 / 宏观行业 / 公司背景 |
| `assigned_side` | A / B / 共同 |
| `material_type` | 文本 / 图片 / 表格 |
| `material_version` | 材料版本 |
| `source_id` | 材料来源编号 |
| `B_PostA_review_permission` | 被分配给 A 的材料在 B_PostA 是否可作为上游材料复核 |
| `gold_fact_ids` | 对应标准事实 |
| `gold_issue_ids` | 对应标准机会/风险 |

不记录 `image_ocr_required`、`vision_qa_relevant`。材料形态由 `material_type` 覆盖；AI 是否能处理图片由实验配置中的 `ai_can_process_images` 覆盖。

### 3.3 `gold_fact` / `gold_issue` / `rubric_dimension`

| 表 | 主要字段 |
|----|----------|
| `gold_fact` | `gold_fact_id`, `company_id`, `material_id`, `indicator_name`, `gold_value`, `gold_unit` |
| `gold_issue` | `gold_issue_id`, `company_id`, `material_id`, `issue_type`, `importance`, `issue_text`, `decision_relevance` |
| `rubric_dimension` | `rubric_dimension_id`, `artifact_type`, `dimension_name`, `weight`, `scoring_version` |

评分维度应保持原子化，公司元数据、标准事实点、标准机会/风险、标准建议、评分维度和权重版本应分开记录。

---

## 4. 公司流转与推送机制数据

### 4.1 `team_company_flow`

每个团队—公司一行。

| 字段 | 含义 |
|------|------|
| `team_company_id` | 团队—公司 ID |
| `team_id` | 团队编号 |
| `company_id` | 公司编号 |
| `initial_company` | 是否首家公司 |
| `A_sequence` | A 处理顺序 |
| `B_sequence` | B 处理顺序 |
| `A_receive_time` | A 收到公司时间 |
| `A_window_start_time` | A 窗口开始 |
| `A_window_lock_time` | A 窗口锁定时间 |
| `company_enter_pool_time` | 公司进入锁定池时间 |
| `B_request_next_company_time` | B 请求下一家公司时间 |
| `locked_pool_size_at_B_request` | B 请求时锁定池大小 |
| `eligible_locked_company_ids` | 可抽取公司集合 |
| `chosen_company_id` | 实际推送给 B 的公司 |
| `company_draw_seed` | 公司池抽取随机种子 |
| `pool_size_at_draw` | 抽取时池大小 |
| `assignment_path` | locked_pool / frontier_preassignment / empty_pool |
| `frontier_preassignment_flag` | 是否使用 B_PreA 预启动 |
| `A_active_company_id_at_B_request` | B 请求时 A 正在处理的公司 |
| `B_receive_time` | B 收到公司时间 |
| `B_preA_pending_A_start` | B_PreA_pending_A 开始时间 |
| `B_preA_pending_A_end` | B_PreA_pending_A 结束时间 |
| `A_output_unlock_time` | A 输出对 B 解锁时间 |
| `B_submit_time` | B 提交最终报告时间 |
| `feedback_submit_time` | B 反馈提交时间 |
| `B_empty_pool_start` | 真实空窗开始 |
| `B_empty_pool_end` | 真实空窗结束 |
| `B_empty_pool_duration` | 真实空窗时长 |
| `archived_time` | 公司流程归档时间 |

公司推送机制不是实验处理变量，而是所有实验局共用流程。后续公司优先从 A 已锁定公司池中随机推送；若锁定池为空但 A 正在处理下一家公司，则 B 进入 `B_PreA_pending_A`；若二者都不存在，B 才进入真实空窗。

### 4.2 由流转表派生的论文变量

这些不要求前端实时计算，但变量字典中要保留：

| 变量名 | 含义 |
|--------|------|
| `ALockedButNotPulled` | A 已锁定但尚未被 B 抽取的公司数 |
| `ACompletedNotIntegrated` | A 已完成但 B 未整合的公司数 |
| `PoolSizeAtDraw` | B 抽取时公司池大小 |
| `FlowLag` | A 锁定到 B 接收的时间 |
| `BIdleWaiting` | B 等待或空窗时间 |
| `BEmptyPoolTime` | B 真实空窗时间 |
| `BPostADuration` | B_PostA 持续时间 |
| `SubmittedPerSegment` | 每工作段提交公司数 |
| `AIncompleteAtLock` | A 锁定时是否未完成 |

第二章明确将 `ACompletedNotIntegrated`, `PoolSizeAtDraw`, `BEmptyPoolTime`, `FlowLag`, `BPostADuration`, `SubmittedPerSegment` 用作生产链瓶颈变量；第三章也将 `ALockedButNotPulled`, `PoolSizeAtDraw`, `FlowLag`, `BIdleWaiting`, `BPostADuration`, `AIncompleteAtLock` 放入 pipeline bottlenecks 表。

---

## 5. A 端填写数据

### 5.1 `a_output`

| 字段 | 含义 |
|------|------|
| `a_output_id` | A 输出 ID |
| `team_company_id` | 团队—公司 ID |
| `participant_id` | A 参与者 |
| `A_window_start_time` | A 窗口开始 |
| `A_window_lock_time` | A 锁定时间 |
| `A_incomplete_at_lock` | 锁定时是否未完成 |
| `A_locked_while_side` | 锁定时是否在副线页 |
| `A_locked_with_pending_ai` | 锁定时是否有未返回主线 AI |
| `A_last_edit_time` | A 最后编辑时间 |
| `A_ai_state_at_window` | A 处理该公司时 AI 状态 |
| `cross_upgrade_boundary_flag` | 是否跨升级边界 |

### 5.2 `a1_fact_entry`

| 字段 | 含义 |
|------|------|
| `a1_entry_id` | A.1 条目 ID |
| `a_output_id` | A 输出 ID |
| `slot_no` | 第几条基础事实 |
| `indicator_name` | 参与者填写的指标名 |
| `indicator_value` | 参与者填写的数值或内容 |
| `indicator_unit` | 单位 |
| `source_material_id` | 来源材料编号 |
| `submit_time` | 填写或提交时间 |

### 5.3 `a2_issue_entry`

| 字段 | 含义 |
|------|------|
| `a2_entry_id` | A.2 条目 ID |
| `a_output_id` | A 输出 ID |
| `material_id` | 材料编号 |
| `opportunity_mark` | 有 / 未发现 / 未作答 |
| `opportunity_evidence` | 机会证据片段 |
| `risk_mark` | 有 / 未发现 / 未作答 |
| `risk_evidence` | 风险证据片段 |

### 5.4 `a3_note`

| 字段 | 含义 |
|------|------|
| `a3_note_id` | A.3 备注 ID |
| `a_output_id` | A 输出 ID |
| `note_type_cross_material` | 跨材料关联提示 |
| `note_type_reliability` | 可信度说明 |
| `note_type_verification` | 核验建议 |
| `note_type_ambiguous` | 模糊线索 / 需谨慎判断 |
| `note_left_blank` | 是否主动留空 |
| `note_text` | 总体交接备注文本 |
| `note_length` | 字数 |

### 5.5 A 端派生评分变量

| 变量名 | 含义 |
|--------|------|
| `A1Correct` | A.1 基础事实正确性 |
| `A2IssueCoverage` | A.2 机会/风险线索覆盖度 |
| `A2FalsePositive` | A.2 误报 |
| `A3NoteProvided` | 是否提供 A.3 备注 |
| `A3NoteQuality` | A.3 备注质量 |
| `A3NoteActionability` | A.3 备注可执行性 |
| `A3NoteVerifiability` | A.3 备注可核验性 |
| `AIncompleteAtLock` | A 锁定时是否未完成 |

第三章已经将这些变量用于 upstream handoff behavior 表，因此变量名应直接照搬。

---

## 6. B 端填写数据

### 6.1 `b_preA_snapshot`

A 输出解锁前保存一次 B 草稿快照。

| 字段 | 含义 |
|------|------|
| `snapshot_id` | 快照 ID |
| `team_company_id` | 团队—公司 ID |
| `participant_id` | B 参与者 |
| `B_receive_time` | B 收到公司时间 |
| `snapshot_time` | 快照时间，通常为 A 输出解锁前 |
| `preA_info_point_json` | PreA 阶段信息点 |
| `preA_memo_text` | PreA 备忘录草稿 |
| `preA_recommendation` | PreA 初始投资倾向 |
| `preA_confidence` | PreA 判断信心 |
| `attempt_access_preunlock` | 解锁前是否尝试访问 A |
| `B_preA_ai_state` | B_PreA 阶段 AI 状态 |

B_PreA 的主要用途是保证 B 在看到 A 输出前形成自有判断，并用于构造解锁前基线判断和解锁后是否修正判断；B_PreA 草稿质量等放入附录变量。

派生变量：

| 变量名 | 含义 |
|--------|------|
| `BPreAQuality` | B_PreA 草稿质量 |
| `PreADecisionCorrect` | PreA 初始判断是否正确 |
| `PreAIssueCoverage` | PreA 信息覆盖 |
| `AttemptAccessPreUnlock` | 解锁前尝试访问 A |

### 6.2 `b_information_point`

| 字段 | 含义 |
|------|------|
| `info_point_id` | 信息点 ID |
| `team_company_id` | 团队—公司 ID |
| `participant_id` | B 参与者 |
| `created_stage` | PreA / PostA |
| `issue_type` | opportunity / risk |
| `importance` | important |
| `info_text` | 信息简述 |
| `source_selected` | 四选一来源 |
| `source_option_version` | 来源选项版本 |
| `created_time` | 创建时间 |
| `updated_time` | 更新时间 |
| `final_included_flag` | 最终是否保留 |

`source_selected` 固定四类：

| 来源值 | 含义 |
|--------|------|
| `own_material` | 自有材料 |
| `upstream_due_diligence` | 上游尽调信息 |
| `upstream_note` | 上游备注 |
| `upstream_material` | 上游材料 |

AI 不作为来源选项。第二章和 B 端参与者可见表都明确：AI 只是辅助工具，B 每条信息点来源包括自有材料、上游尽调信息、上游备注和上游材料。

### 6.3 `b_report`

| 字段 | 含义 |
|------|------|
| `b_report_id` | B 报告 ID |
| `team_company_id` | 团队—公司 ID |
| `memo_text` | 综合判断文本 |
| `memo_length` | 字数 |
| `important_opportunity_count` | 重要机会数量 |
| `important_risk_count` | 重要风险数量 |
| `ordinary_opportunity_count` | 普通机会数量 |
| `ordinary_risk_count` | 普通风险数量 |
| `recommendation_final` | 投资 / 不投资 |
| `confidence_final` | 最终判断信心 |
| `B_postA_ai_state` | B_PostA 阶段 AI 状态 |
| `B_submit_time` | 提交时间 |
| `B_report_complete_flag` | 是否完整提交 |

### 6.4 `feedback`

| 字段 | 含义 |
|------|------|
| `feedback_id` | 反馈 ID |
| `team_company_id` | 团队—公司 ID |
| `feedback` | 是否反馈 |
| `helpfulness_rating` | A 输出帮助程度 |
| `specific_feedback` | 是否给出具体反馈 |
| `thank_feedback` | 是否感谢或认可 |
| `improvement_suggestion` | 是否提出改进建议 |
| `feedback_text` | 反馈文本 |
| `feedback_submit_time` | 反馈提交时间 |

第三章已使用 `Feedback`, `SpecificFeedback`, `ThankFeedback`, `ImprovementSuggestion` 作为反馈行为变量，应直接保留这些论文变量名。

---

## 7. AI 使用日志

### 7.1 `ai_request_log`

| 字段 | 含义 |
|------|------|
| `ai_request_id` | AI 请求 ID |
| `ai_thread_id` | AI 对话线程 ID |
| `participant_id` | 参与者 |
| `team_id` | 团队 |
| `role` | A / B |
| `company_id` | 公司 ID，副线可为空 |
| `team_company_id` | 团队—公司 ID |
| `work_segment` | 工作段 |
| `window_stage` | A_window / B_PreA / B_PostA / side |
| `permission_stage` | 请求时权限状态 |
| `request_time` | 请求发起时间 |
| `response_time` | 返回完成时间 |
| `latency_ms` | 等待时长 |
| `ai_capability_version` | basic / upgraded |
| `ai_can_process_images` | 请求时 AI 是否可处理图片 |
| `ai_model_version` | 请求时模型版本 |
| `prompt_text` | 用户输入 |
| `response_text` | AI 回复 |
| `request_has_image_input` | 本次请求是否含图片 |
| `image_attachment_count` | 图片附件数量 |
| `visible_context_scope` | AI 当时可访问材料范围 |
| `context_material_ids` | AI 当时可访问材料 ID |
| `request_status` | success / timeout / failure / canceled / archived |
| `interrupted_by_lock` | 是否被锁定或阶段切换打断 |
| `archived_only` | 是否只后台归档、不前台展示 |
| `partial_response_length` | 部分回复长度 |
| `ai_request_crossed_lock` | 是否跨锁定点或阶段边界 |

### 7.2 第一章 AI 升级暴露变量

| 变量名 | 含义 |
|--------|------|
| `ai_state_at_request` | 每次 AI 请求发起时 AI 状态 |
| `A_ai_state_at_window` | A 处理该公司时的 AI 状态 |
| `B_preA_ai_state` | B_PreA 阶段 AI 状态 |
| `B_postA_ai_state` | B_PostA 阶段 AI 状态 |
| `cross_upgrade_boundary_flag` | 公司流程是否跨升级边界 |
| `AIExposurePath` | 公司层面 AI 暴露路径，取值 00 / 01 / 11 |
| `BOnlyUpgraded` | A 未升级、B 已升级，即 01 路径 |
| `ABUpgraded` | A 与 B 均已升级，即 11 路径 |
| `CleanUpgradePath` | 是否属于清晰暴露路径样本 |

第一章文档要求记录 A、B_PreA、B_PostA 的 AI 状态，因为同一家公司可能跨越工作段或升级状态。

### 7.3 AI 采纳率后续分析预留

不让参与者选择"AI 来源"。后台只保存：

| 字段 | 用途 |
|------|------|
| `prompt_text` | AI 输入 |
| `response_text` | AI 输出 |
| `request_time`, `response_time` | AI 请求和返回时间 |
| `copy_event`, `paste_event` | 复制粘贴证据 |
| `context_material_ids` | AI 当时可见上下文 |
| `b_information_point.info_text` | B 最终信息点文本 |
| `b_report.memo_text` | B 最终综合判断文本 |
| `a1/a2/a3` | A 最终文本 |
| `score_record` | 后续判定 AI 采纳是否正确或错误 |

后续研究者可生成：

| 派生变量 | 含义 |
|----------|------|
| `AIRequestCount` | AI 请求次数 |
| `AIUsed` | 是否使用 AI |
| `AIWaitMs` | AI 等待总时长 |
| `AITextAdoptionRate` | 最终文本中采纳 AI claim 的比例 |
| `AIFalseAdoptionRate` | 采纳 AI 错误 claim 的比例 |
| `AIBypassA` | B 通过 AI 形成信息但未查看或采纳 A 的程度 |

---

## 8. 行为事件日志与注意力变量

### 8.1 `event_log`

| 字段 | 含义 |
|------|------|
| `event_id` | 事件 ID |
| `participant_id` | 参与者 |
| `team_id` | 团队 |
| `role` | A / B |
| `company_id` | 公司 |
| `team_company_id` | 团队—公司 |
| `work_segment` | 工作段 |
| `window_stage` | A_window / B_PreA / B_PostA / side |
| `server_time` | 服务器时间 |
| `client_time` | 客户端时间 |
| `event_type` | 事件类型 |
| `ui_region` | main_material / form / ai / side / A_output / A_raw |
| `object_type` | material / field / report / ai_request / side_item |
| `object_id` | 对象 ID |
| `browser_focus_status` | 浏览器是否聚焦 |
| `dwell_ms` | 停留时长 |
| `details_json` | 扩展信息 |

关键 `event_type` 至少包括：

| 事件类型 | 含义 |
|----------|------|
| `material_open` | 打开材料 |
| `material_scroll` | 滚动材料 |
| `field_edit` | 编辑字段 |
| `copy_event` | 复制 |
| `paste_event` | 粘贴 |
| `main_ai_request` | 主线 AI 请求 |
| `main_ai_response` | 主线 AI 返回 |
| `side_ai_request` | 副线 AI 请求 |
| `side_ai_response` | 副线 AI 返回 |
| `side_open` | 打开副线 |
| `side_close` | 关闭副线 |
| `side_item_submit` | 提交副线题 |
| `attempted_access_preunlock` | B_PreA 阶段尝试访问 A |
| `B_open_A_output_page` | B 打开 A 产出页 |
| `B_open_A_note` | B 查看 A 备注 |
| `B_open_A_raw_material` | B 打开 A 原始材料 |
| `B_source_select` | B 选择信息点来源 |
| `B_submit_report` | B 提交报告 |
| `feedback_submit` | B 提交反馈 |
| `tab_hidden` | 浏览器失焦 |
| `tab_visible` | 浏览器回到前台 |
| `disconnect_start` | 断线开始 |
| `disconnect_end` | 断线结束 |

### 8.2 注意力派生变量

| 变量名 | 含义 |
|--------|------|
| `MainTimeShare` | 主线时间占比 |
| `SideTimeShare` | 副线时间占比 |
| `SwitchCount` | 主副线切换次数 |
| `MainSpellLength` | 连续主线工作段长度 |
| `RestartDelay` | 从副线返回主线后的恢复时滞 |
| `LateUnlockReturn` | A 解锁后是否迟迟未回到主线 |
| `SideDuringAIWait` | AI 等待期间是否进入副线 |
| `MainDuringAIWait` | AI 等待期间是否继续主线 |
| `IdleDuringAIWait` | AI 等待期间是否无操作 |
| `ReturnDelayAfterAIResponse` | AI 返回后多久恢复主线操作 |
| `TotalMainTime` | 团队或个人总主线时间 |
| `TotalSideTime` | 团队或个人总副线时间 |

第二章已经明确将 `MainTimeShare`, `SideTimeShare`, `SwitchCount`, `MainSpellLength`, `RestartDelay`, `LateUnlockReturn` 用于注意力机制表，并将 `SideDuringAIWait`, `MainDuringAIWait`, `IdleDuringAIWait`, `ReturnDelayAfterAIResponse` 用于 AI 等待期间注意力分配表。

---

## 9. 副线任务数据

### 9.1 `side_release_log`

| 字段 | 含义 |
|------|------|
| `release_id` | 副线释放记录 ID |
| `session_id` | 实验场次 |
| `team_id` | 团队 |
| `participant_id` | 参与者 |
| `work_segment` | 工作段 |
| `side_dispatch_mode` | continuous / batch |
| `side_item_id` | 副线题目 ID |
| `release_time` | 释放时间 |
| `side_prompt_shown` | 是否显示提示 |
| `side_prompt_text` | 提示文本 |
| `side_prompt_show_pending_count` | 固定 false |
| `side_item_archived_at_segment_end` | 段末是否归档 |

### 9.2 `side_response_log`

| 字段 | 含义 |
|------|------|
| `side_response_id` | 副线作答 ID |
| `side_item_id` | 副线题目 ID |
| `participant_id` | 参与者 |
| `team_id` | 团队 |
| `work_segment` | 工作段 |
| `open_time` | 打开时间 |
| `submit_time` | 提交时间 |
| `answer_selected` | 参与者答案 |
| `gold_label` | 标准标签 |
| `side_correct` | 是否答对 |
| `side_score` | 副线得分 |

### 9.3 副线批处理派生变量

| 变量名 | 含义 |
|--------|------|
| `SideSpellLength` | 单次副线停留时长 |
| `SideItemsPerSpell` | 单次副线打开完成条目数 |
| `BulkSideAI` | 是否疑似副线 AI 批处理 |
| `BulkItemCount` | 批处理推测条目数 |
| `PasteInSideAI` | 是否发生副线 AI 粘贴 |
| `SideAccuracy` | 副线准确率 |
| `SideScorePerSideMinute` | 副线单位时间得分 |
| `SideScore` | 副线总得分 |

第二章明确 batch 可能既减少切换，也可能诱导集中处理副线；因此 `SideSpellLength`, `BulkSideAI`, `BulkItemCount`, `PasteInSideAI` 应作为工作流变量记录，而不是作为违规剔除依据。

---

## 10. 叙事暴露与问卷数据

### 10.1 `narrative_exposure`

| 字段 | 含义 |
|------|------|
| `exposure_id` | 叙事暴露 ID |
| `team_id` | 团队 |
| `participant_id` | 参与者 |
| `work_segment` | 工作段 |
| `treatment_assignment` | coop_narrative / neutral_info |
| `narrative_theme` | T1 / T2 / T3 / neutral |
| `theme_order` | 六种主题顺序之一 |
| `narrative_text_id` | 长文本 ID |
| `show_time` | 展示时间 |
| `close_time` | 关闭时间 |
| `reading_duration_ms` | 阅读时长 |
| `completed_flag` | 是否完成阅读 |
| `side_news_theme_id` | 副线新闻所属叙事主题 |
| `news_sequence_id` | 新闻流随机序列编号 |
| `news_order_seed` | 新闻顺序随机种子 |
| `news_id_order_within_team` | 团队内新闻展示顺序 |
| `news_id_display_time` | 新闻展示时间 |

合作叙事包括 T1 互补分工、T2 验证留痕、T3 共同责任；合作叙事组在三个工作段内随机接触三类主题的六种顺序之一，中性信息组也应有匹配文本和新闻流版本。

### 10.2 `questionnaire_response`

| 字段 | 含义 |
|------|------|
| `response_id` | 问卷回答 ID |
| `participant_id` | 参与者 |
| `team_id` | 团队 |
| `role` | A / B |
| `timepoint` | pre / segment_1_post / segment_2_post / segment_3_post / post |
| `item_id` | 题项 ID |
| `construct` | 构念 |
| `raw_value` | 原始回答 |
| `reverse_coded_flag` | 是否反向题 |
| `response_time_ms` | 回答耗时 |
| `questionnaire_version` | 问卷版本 |

### 10.3 问卷派生变量

| 变量名 | 含义 |
|--------|------|
| `AICapabilityBelief` | AI 能力信念 |
| `AIReliabilityBelief` | AI 可靠性信念 |
| `AICheckingBelief` | AI 校验信念 |
| `CoopBelief` | 综合合作信念 |
| `ComplementBelief` | 互补分工信念 |
| `TraceBelief` | 验证留痕信念 |
| `SharedResponsibilityBelief` | 共同责任信念 |
| `AIBypassBelief` | AI 可绕过队友信念 |
| `SubjectiveLoad` | 主观负荷 |
| `TimePressure` | 时间压力 |
| `SideInterference` | 副线干扰感 |
| `JudgmentConfidence` | 判断信心 |
| `NarrativeRecall` | 叙事回忆 |
| `CoopFrameRecognition` | 合作框架识别 |
| `NarrativeCredibility` | 叙事可信度 |
| `PerceivedCooperationEmphasis` | 感知合作强调程度 |
| `TeamAttention` | 团队注意力保持能力，个体问卷聚合后生成 |

第三章已经使用 `CoopBelief`, `ComplementBelief`, `TraceBelief`, `SharedResponsibilityBelief`, `AIBypassBelief` 作为信念结果，并使用 `NarrativeRecall`, `CoopFrameRecognition`, `NarrativeCredibility`, `PerceivedCooperationEmphasis` 作为操纵检验。

---

## 11. 评分、主结果与论文变量

### 11.1 `score_record`

| 字段 | 含义 |
|------|------|
| `score_id` | 评分 ID |
| `artifact_type` | A1 / A2 / A3 / B_info_point / memo / report / side |
| `artifact_id` | 被评分对象 ID |
| `team_company_id` | 团队—公司 ID |
| `rubric_dimension_id` | 评分维度 |
| `score_value` | 分数 |
| `score_weight` | 权重 |
| `scoring_version` | 评分版本 |
| `scorer_id` | 评分员或算法 |
| `scorer_type` | RA / system / model |
| `blind_score_flag` | 是否盲评 |
| `adjudication_flag` | 是否经过裁决 |
| `score_time` | 评分时间 |

### 11.2 团队—公司层面主结果变量

三章共用以下主结果变量：

| 变量名 | 含义 |
|--------|------|
| `Completed` | 团队是否对公司完成 B 端提交 |
| `RealizedOutput` | 未提交公司记为 0 的实际实现产出 |
| `ConditionalQuality` | 已提交报告的条件质量 |
| `DecisionCorrect` | 最终投资建议是否正确 |

第三章文档明确：`Completed` 衡量完成边际，`RealizedOutput` 将未提交公司记为 0，`ConditionalQuality` 衡量已提交报告的条件质量，`DecisionCorrect` 衡量最终投资建议是否正确。

### 11.3 质量分项变量

| 变量名 | 含义 |
|--------|------|
| `ImportantIssueCoverage` | 重要机会/风险覆盖度 |
| `CriticalRiskRecall` | 关键风险召回 |
| `CriticalOpportunityRecall` | 关键机会召回 |
| `FalsePositive` | 错误信息点或误报 |
| `MemoQuality` | 综合判断或备忘录质量 |
| `SourceTransparency` | 来源透明度 |

第三章已将这些变量放入质量分项表；第二章主文表格也使用同一质量分项口径。

### 11.4 团队层面聚合变量

| 变量名 | 含义 |
|--------|------|
| `TotalCompleted` | 团队总完成公司数 |
| `TotalRealizedOutput` | 团队总实现产出 |
| `MeanConditionalQuality` | 团队平均条件质量 |
| `TotalMainTime` | 团队总主线时间 |
| `TotalSideTime` | 团队总副线时间 |
| `SideScore` | 团队或个人副线得分 |

第三章 Table 5 使用 `TotalCompleted`, `TotalRealizedOutput`, `MeanConditionalQuality`, `TotalMainTime`, `TotalSideTime`, `SideScore`；第二章 Table 4 也使用团队层面总完成数、总产出、主副线时间和副线得分。

### 11.5 B_PostA 承接变量

| 变量名 | 含义 |
|--------|------|
| `ViewA` | B 是否打开 A 产出页 |
| `ValidViewA` | B 是否有效查看 A 产出 |
| `TimeToViewA` | A 解锁后到 B 首次查看 A 的时间 |
| `ViewNote` | B 是否查看 A 总体备注 |
| `ReviewRawA` | B 是否进入 A 原始材料复核 |
| `AdoptA` | B 是否采纳 A 信息 |
| `AdoptAImp` | B 是否采纳 A 的重要信息 |
| `AdoptNote` | B 是否采纳 A 备注 |
| `ASourceShare` | B 最终信息点中 A 来源占比 |
| `RevisedRecommendation` | B 解锁 A 后是否修改最终建议 |
| `WeakAdoption` | B 查看 A 但未有效采纳 A 信息 |

第三章直接使用 `ViewA`, `ValidViewA`, `TimeToViewA`, `ViewNote`, `ReviewRawA`, `AdoptA`, `AdoptNote`；第一章合作行为模型还列出 `AdoptAImp`, `ASourceShare`, `Feedback`, `SpecificFeedback`, `WeakAdoption`。

---

# 四、按章节整理的变量清单

## 第一章：AI 能力升级实验

### 处理变量

| 变量名 | 含义 |
|--------|------|
| `early_upgrade` | 早升级团队 |
| `late_upgrade` | 晚升级团队 |
| `upgrade_cohort` | early_upgrade / late_upgrade |
| `segment_1_ai_state` | 段 1 AI 状态 |
| `segment_2_ai_state` | 段 2 AI 状态 |
| `segment_3_ai_state` | 段 3 AI 状态 |
| `AIExposurePath` | 公司层面暴露路径，00 / 01 / 11 |
| `BOnlyUpgraded` | 01：A 未升级，B 已升级 |
| `ABUpgraded` | 11：A 和 B 均升级 |
| `cross_upgrade_boundary_flag` | 公司是否跨升级边界 |

### 主结果与机制变量

| 类型 | 变量 |
|------|------|
| 主结果 | `Completed`, `RealizedOutput`, `ConditionalQuality`, `DecisionCorrect` |
| 质量分项 | `ImportantIssueCoverage`, `CriticalRiskRecall`, `CriticalOpportunityRecall`, `FalsePositive`, `MemoQuality`, `SourceTransparency` |
| A 端机制 | `A1Correct`, `A2IssueCoverage`, `A2FalsePositive`, `A3NoteProvided`, `A3NoteQuality`, `A3NoteActionability`, `A3NoteVerifiability`, `AIncompleteAtLock` |
| B_PostA 承接 | `ViewA`, `ValidViewA`, `ViewNote`, `ReviewRawA`, `AdoptAImp`, `AdoptNote`, `ASourceShare`, `WeakAdoption` |
| 反馈 | `Feedback`, `SpecificFeedback` |
| 注意力 | `MainTimeShare`, `SideTimeShare`, `SwitchCount`, `MainSpellLength`, `AIRequestCount`, `SideDuringAIWait`, `RestartDelay` |
| 异质性 | `material_assignment_pattern`, `A_material_attribute`, `B_material_attribute`, `BPreA_sufficiency`, `BReport_sufficiency`, `AResidualValue`, `AExclusiveVetoRisk`, `IntegrationDemand`, `AIWaitExposure` |

第一章关注 AI 升级是否沿 A/B 生产链传导为团队绩效，因此必须同时记录 A 输出、B 承接、AI 状态、注意力和合作行为。第一章文档也明确主分析单位为团队—公司，并使用 `team_company_flow`, `window_behavior`, `ai_request_log`, `source_trace`, `output_score`, `quality_flags` 和问卷数据。

---

## 第二章：副线到达节奏实验

### 处理变量

| 变量名 | 含义 |
|--------|------|
| `treatment_assignment` | continuous / batch |
| `Batch` | batch=1，continuous=0 |
| `side_dispatch_mode` | continuous / batch |
| `side_release_count` | 副线释放数量 |
| `side_prompt_count` | 副线提示次数 |
| `side_difficulty_index` | 副线难度 |
| `side_reward_version` | 副线奖励版本 |

### 主结果与机制变量

| 类型 | 变量 |
|------|------|
| 团队层面 | `TotalCompleted`, `TotalRealizedOutput`, `TotalMainTime`, `TotalSideTime`, `SideScore` |
| 团队—公司主结果 | `Completed`, `RealizedOutput`, `ConditionalQuality`, `DecisionCorrect` |
| 质量分项 | `ImportantIssueCoverage`, `CriticalRiskRecall`, `CriticalOpportunityRecall`, `FalsePositive`, `MemoQuality`, `SourceTransparency` |
| 注意力切换 | `MainTimeShare`, `SideTimeShare`, `SwitchCount`, `MainSpellLength`, `RestartDelay`, `LateUnlockReturn` |
| AI 等待 | `SideDuringAIWait`, `MainDuringAIWait`, `IdleDuringAIWait`, `ReturnDelayAfterAIResponse` |
| 副线批处理 | `SideSpellLength`, `SideItemsPerSpell`, `BulkSideAI`, `BulkItemCount`, `PasteInSideAI`, `SideAccuracy`, `SideScorePerSideMinute` |
| A 输出 | `A1Correct`, `A2IssueCoverage`, `A2FalsePositive`, `A3NoteProvided`, `A3NoteQuality`, `AIncompleteAtLock` |
| B_PostA 承接 | `ViewA`, `ValidViewA`, `ReviewRawA`, `AdoptA`, `RevisedRecommendation` |
| B_PreA 附录 | `BPreAQuality`, `PreADecisionCorrect`, `PreAIssueCoverage`, `AttemptAccessPreUnlock` |
| 生产链瓶颈 | `ACompletedNotIntegrated`, `PoolSizeAtDraw`, `BEmptyPoolTime`, `FlowLag`, `BPostADuration`, `SubmittedPerSegment` |
| 异质性 | `AIWaitExposure`, `IntegrationDemand`, `AResidualValue`, `TeamAttention` |

第二章的机制重点是注意力、AI 等待、副线吸收、批处理和 B_PostA 承接。文档明确所有机制变量都是处理后的行为结果，不作为主回归普通控制变量。

---

## 第三章：合作叙事实验

### 处理变量与操纵检验

| 变量名 | 含义 |
|--------|------|
| `treatment_assignment` | coop_narrative / neutral_info |
| `CoopNarr` | 合作叙事=1 |
| `theme_order` | T1/T2/T3 六种顺序之一 |
| `NarrativeTheme_T1` | 当前段是否为互补分工主题 |
| `NarrativeTheme_T2` | 当前段是否为验证留痕主题 |
| `NarrativeTheme_T3` | 当前段是否为共同责任主题 |
| `NarrativeRecall` | 叙事回忆 |
| `CoopFrameRecognition` | 合作框架识别 |
| `NarrativeCredibility` | 叙事可信度 |
| `PerceivedCooperationEmphasis` | 感知合作强调程度 |

### 主结果与机制变量

| 类型 | 变量 |
|------|------|
| 团队层面 | `TotalCompleted`, `TotalRealizedOutput`, `MeanConditionalQuality`, `TotalMainTime`, `TotalSideTime`, `SideScore` |
| 团队—公司主结果 | `Completed`, `RealizedOutput`, `ConditionalQuality`, `DecisionCorrect` |
| 质量分项 | `ImportantIssueCoverage`, `CriticalRiskRecall`, `CriticalOpportunityRecall`, `FalsePositive`, `MemoQuality`, `SourceTransparency` |
| 生产链瓶颈 | `ALockedButNotPulled`, `PoolSizeAtDraw`, `FlowLag`, `BIdleWaiting`, `BPostADuration`, `AIncompleteAtLock` |
| 信念变量 | `CoopBelief`, `ComplementBelief`, `TraceBelief`, `SharedResponsibilityBelief`, `AIBypassBelief` |
| A 端交接 | `A1Correct`, `A2IssueCoverage`, `A2FalsePositive`, `A3NoteProvided`, `A3NoteQuality`, `A3NoteActionability`, `A3NoteVerifiability`, `AIncompleteAtLock` |
| B_PostA 承接 | `ViewA`, `ValidViewA`, `TimeToViewA`, `ViewNote`, `ReviewRawA`, `AdoptA`, `AdoptNote` |
| 反馈行为 | `Feedback`, `SpecificFeedback`, `ThankFeedback`, `ImprovementSuggestion` |
| 替代通道 | `MainTimeShare`, `SideTimeShare`, `SwitchCount`, `MainSpellLength`, `AIRequestCount`, `SideDuringAIWait`, `RestartDelay` |
| 异质性 | `AInfoPivotal` |

第三章的表格安排已经系统列出这些变量：团队层面 ITT、团队—公司主结果、质量分项、生产链瓶颈、信念效应、A 端交接、B_PostA 承接、反馈行为、替代通道和 A 端信息决策关键性异质性。

---

# 五、明确不需要开发者单独记录的变量

以下变量不要作为独立后台字段记录：

| 原变量或想法 | 处理方式 | 原因 |
|-------------|----------|------|
| `ai_image_upload_enabled` | 合并为 `ai_can_process_images` | 当前实验中图片上传、OCR、视觉问答能力等同 |
| `ai_ocr_enabled` | 合并为 `ai_can_process_images` | 不构成独立处理 |
| `ai_vision_qa_enabled` | 合并为 `ai_can_process_images` | 不构成独立处理 |
| `image_ocr_required` | 删除 | `material_type=图片` 已覆盖 |
| `vision_qa_relevant` | 删除 | 不需要开发者判断材料是否"视觉问答相关" |
| `AI` 作为 B 来源选项 | 删除 | B 来源固定为四类，AI 只是辅助工具 |
| `source_inconsistent_AI` | 删除 | AI 不作为来源，无法定义来源不一致 |
| `MainTimeShare` 等注意力变量 | 不作为前端原始字段 | 由 `event_log` 后处理生成 |
| `ViewA`, `ValidViewA`, `ReviewRawA` | 不作为前端人工字段 | 由打开、停留、滚动、点击事件派生 |
| `AITextAdoptionRate` | 不作为参与者自报字段 | 由 AI 日志、复制粘贴、文本相似度和人工编码生成 |
| `FlowLag`, `BPostADuration` | 不作为前端填写字段 | 由流程时间戳计算 |
| `A3NoteQuality`, `MemoQuality` | 不作为实时字段 | 由 `score_record` 或后编码生成 |

---

# 六、开发者最小实现清单

开发端至少需要稳定导出以下表：

| 表名 | 必要性 |
|------|--------|
| `experiment_session` | P0 |
| `randomization_audit` | P0 |
| `participant` | P0 |
| `team_roster` | P0 |
| `company_master` | P0 |
| `material_source` | P0 |
| `gold_fact` | P1 |
| `gold_issue` | P1 |
| `team_company_flow` | P0 |
| `a_output`, `a1_fact_entry`, `a2_issue_entry`, `a3_note` | P0 |
| `b_preA_snapshot`, `b_information_point`, `b_report`, `feedback` | P0 |
| `ai_request_log` | P0 |
| `event_log` | P0 |
| `side_release_log`, `side_response_log` | P0 |
| `narrative_exposure` | P0，第三章必须 |
| `questionnaire_response` | P0 |
| `score_record` | P1 |
| `quality_flags` | P0 |
| `variable_dictionary` | P1 |

一句话版本：**开发者只需要保证随机化、流程、填写、AI、行为、副线、叙事、问卷、评分和异常数据完整落库；三章论文变量可以在后台导出时由这些原始表派生。**
