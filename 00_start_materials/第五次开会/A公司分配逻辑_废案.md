推荐方案：不要让 B 等“已锁定公司池”，而是允许 B 提前进入下一家公司的 PreA



锁定池优先；若锁定池为空，则 B 可以接收 A 当前正在处理的公司，但只能进入 B\_PreA，不能查看 A 输出，不能提交。



这可以叫做 frontier preassignment 或 B\_PreA 预启动机制。



具体规则如下。



1\. B 完成当前公司后，系统先检查已锁定公司池



若存在：



A\_locked \&\& not\_assigned\_to\_B



则从这些公司中随机抽取一家公司给 B。



这是正常路径。



2\. 若已锁定公司池为空，但 A 正在处理下一家公司



则系统将 A 当前正在处理的公司分配给 B，B 进入该公司的 B\_PreA\_pending\_A 状态。



此时 B 只能看到：



B 自有材料；

B 报告草稿区；

B 主线 AI，但 AI 只能访问 B 自有材料和 B 已输入内容；

副线任务。



B 不能看到：



A 微观材料；

A 尽调表；

A 总体备注；

A 原始材料复核入口。



这不破坏信息边界。V3 本来就要求 B\_PreA 只能看到 B 自有材料，不能看到 A 微观材料、A 尽调表、A 总体备注，也不能让 AI 访问 A 端信息。



3\. A 输出解锁仍使用原公式



解锁时间继续使用 V3 的统一公式：



A\_output\_unlock\_time=max(A\_window\_lock\_time, B\_receive\_time+B\_preA\_minutes)



V3 已经把这条公式作为首家公司和后续公司的统一解锁规则。



例：



t=8：B 完成第 1 家；

已锁定池为空；

A 正在处理第 2 家；

系统将第 2 家推给 B；

B 从 t=8 开始看第 2 家的 B 自有材料；

A 第 2 家在 t=10 锁定；

若 B\_preA\_minutes=5，B\_PreA 到 t=13 结束；

A 输出在 t=13 解锁，因为 max(10, 8+5)=13。



这样 B 在 t=8—13 之间不是空窗，而是在做有意义的 B\_PreA 独立判断。A 输出仍然不会提前泄露。



4\. 如果 B\_PreA 到时但 A 还没锁定



例如 B 在 t=8 收到公司，B\_PreA 到 t=13，但 A 因为参数调整或异常到 t=15 才锁定，则：



B 仍停留在该公司；

B 可以继续修改基于 B 自有材料的草稿；

B 可以继续调用仅限 B 材料的主线 AI；

B 可以切换副线；

A 产出页显示“等待 A 输出完成”；

B 不能最终提交。



系统记录：



B\_preA\_elapsed\_before\_A\_lock=1

B\_wait\_for\_A\_after\_preA\_start

B\_wait\_for\_A\_after\_preA\_end

B\_wait\_for\_A\_duration



5\. 如果 A 已锁定但 B\_PreA 未到时



则继续等 B\_PreA 到时。A 输出不提前显示。这样保证 B 有完整独立判断窗口。



为什么这个方案内部有效性更好

第一，避免“快 B 多拿副线时间”



如果采用纯空窗，快 B 提前完成主线后可以做更多副线。由于副线有个人收益，这会改变 B 的激励结构。B 可能为了多做副线而过快提交主线。



B\_PreA 预启动机制把这段时间用于下一家公司 B 自有材料处理，而不是把它变成额外副线时间。这样更符合实验目标：B 的主要时间仍在团队生产链中流动。



第二，不破坏 B\_PreA 独立判断



B 虽然提前进入下一家公司，但仍然只看自己的材料。A 输出、A 原始材料、A 备注都不可见。B\_PreA 的识别价值仍然存在。



V3 的 B\_PreA 本来就是为了让 B 在看到 A 输出前形成独立判断；A 输出解锁后再保存 B\_PreA 快照并进入 B\_PostA。 预启动机制只是让 B\_PreA 发生得更早，不改变其信息边界。



第三，减少启动期的机械空窗




B\_PreA 预启动机制能让流水线更顺：



A：C1 0—5，C2 5—10，C3 10—15……

B：C1 0—8，C2 8—13+，C3 之后……



这样 A/B 仍是异步流水线，但 B 不会因为公司池尚未形成而无事可做。



第四，保留 A/B 上下游关系



这个方案并不意味着 B 绕过 A。B 只是先处理自己的材料。B 的最终提交仍必须等 A 输出解锁；B\_PostA 阶段仍然观察 B 是否查看 A、采纳 A、复核 A 和反馈 A。



V3 本来已经明确：B 最终提交前必须满足 A 输出已解锁、最低信息点数量、来源必填、备忘录和最终建议完整；但不要求 B 打开 A 产出页。



需要修改的状态机



建议新增两个状态。



原状态机



A\_active → A\_locked → in\_pool → B\_preA → B\_postA



修改后状态机



保留原路径：



A\_active → A\_locked → in\_pool → B\_preA → B\_postA



新增空池补位路径：



A\_active → B\_preA\_pending\_A → B\_postA



其中：



状态	含义

B\_preA\_pending\_A	B 已开始处理该公司的 B 自有材料，但 A 输出尚未锁定或尚未满足解锁条件。

B\_preA\_waiting\_for\_A	B\_PreA 最短时间已到，但 A 仍未锁定；B 只能继续 B 自有材料草稿、AI 或副线，不能提交。

分配规则



B 完成当前公司和反馈后：



若 locked\_pool\_size > 0，从已锁定池随机抽取；

若 locked\_pool\_size = 0 且存在 A\_active\_company\_not\_assigned\_to\_B，将该公司分配给 B，进入 B\_preA\_pending\_A；

若两者都不存在，才进入真正的空窗状态。

真实空窗状态如何设计



真实空窗仍要保留，因为极端情况下可能发生，例如：



A 掉线；

A 当前公司被锁定失败；

工作段边界；

B 极快完成且 A 暂无 active 公司；

技术异常。



但真实空窗应是兜底状态，不是常规工作流。



真实空窗规则建议保持 V3 当前口径：



主线材料区为空；

报告区不可编辑；

最终提交按钮不可用；

副线任务可继续；

系统不主动提醒 B 新公司何时到达；

当公司可推送且 B 返回主线时，系统显示下一家公司。



V3 当前已经这样描述公司池为空时的 B 空窗状态：B 主线不可编辑，副线任务仍可进行，系统不主动提醒，等有公司可推送且 B 返回主线时再显示。



但需要新增日志：



B\_empty\_pool\_start

B\_empty\_pool\_end

B\_empty\_pool\_duration

B\_empty\_pool\_reason

B\_empty\_pool\_to\_side

B\_empty\_pool\_idle

B\_empty\_pool\_segment

B\_empty\_pool\_is\_startup



第二章也已经把 BEmptyPoolTime 作为团队生产链瓶颈变量之一，用于判断处理是否改变下游空窗和上游库存。





仍需处理的顺序问题



在锁定池为空时，B 没有可随机抽取的已完成公司，因此不可能保持“B 顺序完全独立于 A”。此时最重要的不是强行随机，而是保证：



A 的公司顺序本身在团队之间随机或分块平衡；

空池补位规则对所有团队一致；

记录 B 是否接收了 A\_active 公司；

对 initial\_company 和 pipeline\_startup 做标记。



建议新增：



pipeline\_startup\_flag

frontier\_preassignment\_flag

B\_received\_A\_active\_company

A\_active\_company\_id\_at\_B\_request

locked\_pool\_size\_at\_B\_request

eligible\_locked\_company\_ids



这样即便 B 在启动期跟随 A 的当前公司，也不会成为不可观察的选择偏差。

