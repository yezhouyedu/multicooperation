| 文档变量 / 记录项 | 保存来源表或文件 | 写入触发点 | 导出位置 | 状态 | 备注与风险 |
|---|---|---|---|---|---|
| session metadata / randomization | Session, RandomizationAudit | export generation | sessions/*/session_metadata.json, randomization.json | 已通过 | 2 sessions checked |
| participant tree and core files | Participant, Pairing, QuestionnaireResponse | export generation | sessions/*/participants/* | 已通过 | 4 participant folders checked |
| company metadata / answers / snapshots / main AI files | TaskAssignment, Company, TaskSnapshot, AiMessageLog | task save, segment freeze, AI request, export generation | practice_round/companies/*, formal_segments/*/companies/* | 已通过 | company files exist for touched tasks |
| image attachments | AiMessageLog.attachments, storage/attachments | AI image upload / export generation | participants/*/attachments/images + ai_chat.jsonl | 已通过 | attachment JSON paths resolve inside participant attachments folder |
| side task correctness | SideTaskPlan, SideTaskItem.goldAnswer, SideTaskExposureLog | side task answer / export generation | side_tasks/side_responses.jsonl, variables.json | 已通过 | 36 answered side rows checked |
| side task reaction time | SideTaskExposureLog | side task opened / answered | side_tasks/side_responses.jsonl | 已通过 | reactionTimeMs is null or non-negative |
| main AI task attribution | AiMessageLog | main AI request | companies/*/ai_chat.jsonl | 缺失 | main AI user messages include companyId, taskAssignmentId, and segmentIndex |
| side AI task attribution | AiMessageLog | side AI request | side_tasks/side_ai_chat.jsonl | 有风险 | 3 side AI user messages have no sideTaskPlanId |
| login / ready events | ExperimentEvent | auth login / ready click | participant_metadata.json, events/events.jsonl | 缺失 | new sessions should include participant_login; old sessions may fall back to Participant.createdAt |
| variables.json summaries | export post-processing | export generation | participants/*/variables.json | 已通过 | core treatment, mainline, AI, side-task, and questionnaire summaries are present |
| paper scoring / gold facts / complex attention variables | future scoring and behavior modules | post-experiment analysis | not in phase-one export tree | 后续模块 | kept out of the first recording layer by design |
| AI adoption rate | AI logs + final text + future coding/similarity logic | post-processing | derived from ai_chat.jsonl and answer_content.json | 可后处理 | raw logs and final drafts are saved; direct adoption score is not stored |
