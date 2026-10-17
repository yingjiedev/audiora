# 首页折页动画几何修正（2026-10-13）

## 本轮对照证据

用户提供的六张原始 1220×2656 JPG 已打开，并逐字节保存到 `evidence/home-hinge/`。这是当前版本与参考应用的用户截图，不是新版本截图；文件排列按可见折叠阶段，不代表已知时间或手势速度。

1. `01-current-turn.jpg`：当前收藏页在侧面时整体上下对称缩小，铰链与主卡之间出现底色空隙；主卡左圆角已经展开。
2. `02-current-edge.jpg`：当前侧页变成细线，却仍与主卡分离。接近 90° 时应该是接合的铰链线。
3. `03-current-back-sliver.jpg`：当前背面只有左侧尖条；没有形成从侧面转到主卡背后的纸面轨迹。
4. `04-reference-turn.jpg`：参考铰链贴住主卡，自由边明显向下倾斜，并且延伸到主卡底部以下。
5. `05-reference-edge.jpg`：参考侧页继续经过接近侧面的阶段，下方纸角仍可见；没有横向空隙。
6. `06-reference-back.jpg`：参考纸面大部藏到主卡后方，底角留在下方后逐渐收起，主卡及邻卡保持连续平移。

参考第 4 张的原图灰色边界采样：自由边 x=170 的可见 y 约 654–1025；主卡 x=300 的范围约 455–969。自由边上端下移约 199 像素、下端下移约 56 像素，是向卡片下方消失点收缩的轮廓，不是绕卡片中心上下对称缩小。截图不能证明参考的精确 easing、帧率、触摸速度、后台行为或可访问性，未据此假称复现视频时序。

## 原因与最终实现

`HomeFeatureDeck` 的旧变换以中心旋转加两次 translateX 模拟右侧铰链，并将 perspective 放在最外层。安装依赖 RN 0.86 的 `BaseViewManager.java` 会将该矩阵分解为 translation、Euler rotation、scale 与 cameraDistance，再分别写入 Android View；透视矩阵包含平移与非单位齐次项时，这种写法不能保持原先假设的边缘投影。截图中分离的铰链与此一致。

- 改为真实原生中心铰链：旋转载体宽度是纸页的两倍，纸页只占左半边；载体的中心正好位于纸页右边缘。载体仅使用 perspective + rotateY，不再混合平移补偿或添加新的原生模块。
- 从实际 onLayout 得到主卡高度，载体高度设为 2.8 倍；原生中心位于卡高的 1.4 倍，从而让自由边向下收缩、背面底角绕到主卡后方。载体透明的其余区域不响应触摸，只保留真实收藏按钮。
- 透视距离为纸页宽的 2.5 倍；仍按同一 UI 线程 scroll offset 在一个纸页宽内完成 0° 到 −180°。所有宽度、折叠停靠点与拾音/主卡业务动作保留，反向拖动走同一连续轨迹。
- 纸面和印刷内容分开：侧面仅淡出印刷文字，纸面保持；主卡位于纸面之上，使 90° 之后的背面藏到主卡后面，下方纸角可以继续移动。最后约 11° 将剩余纸面清到透明，避免完全收页后透过主卡圆角留下尖角。
- 主卡左圆角从纸页进入背面的阶段才逐渐恢复；不再从开始拖动就挖开接合边。
- 横向视口按实际卡高保留 12% 底部空间，覆盖理想投影最大约 11.43% 卡高的下沉，防止折页底角被裁掉。布局测量发生时更新一次高度；每帧滚动仍仅写 shared offset，无 JS setState。
- Native 载体与层级容器固定挂载、禁止折叠省略，保留硬件纹理、关闭滚动裁剪优化。Reduce Motion 保留平面可操作收藏页与原静态滚动，不透明消失。
- 不变更用户颜色设置、主题派生、图片内容或歌曲/收藏/播放逻辑；继续使用语义表面色。

官方说明与本地依赖互相核对：[React Native transform/transformOrigin](https://reactnative.dev/docs/0.86/transforms)、[Reanimated supported properties](https://docs.swmansion.com/react-native-reanimated/docs/guides/supported-properties/)。原生视图的默认变换中心在自身中心；本次使用布局直接放置中心，避免依赖复杂透视矩阵分解来模拟铰链。

## 验证和限制

- 聚焦 6 suites / 99 tests 通过；其中折页组件 27 tests。新增 4 屏宽 × 3 实际卡高的每组 61 个连续进度，独立投影实际载体的 native-center 变换，验证铰链两端固定、自由边下沉、纸面进入背后、底部空间足够、完全闭合清除残边与反向重新出现。另覆盖无效测量、圆角时机和减少动态效果。
- 颜色回归 19 suites / 220 tests 通过；check:colors、check:ui、check:motion、typecheck:runtime 通过。修改的两个 TS 文件 ESLint 0 errors / 0 warnings，diff whitespace 检查通过。
- 完整仓库 npm run lint 已执行，仍有既有 14 errors / 100 warnings，自动格式化的两个无关文件已恢复。扩展 TypeScript 存在其它仓库诊断；本轮文件 0 诊断。未扩大基线或豁免，未重复完整 Jest。
- 数学投影与 Jest 只验证几何和组件行为，不证明 Android GPU 最终像素、帧率、真机命中或用户认可外观。按 AGENTS.md，构建并保留数据安装、核对精确版本后停止设备操作，由用户进行原生视觉及手势验收。

Native visual QA final result: **blocked — pending user acceptance**。

## 预览交付

- 应用源码 `53208df99b5df3b343568927f950c57aefa9e37d`；版本 `0.3.1-preview.i88.hinge.20261013.090400` / versionCode `1791853442`；包名 `io.github.yingjiedev.audiora`，ABI arm64-v8a。后续提交只补交付记录，不改变包内应用源码。
- APK `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.hinge.20261013.090400-arm64-v8a-release.apk`，SHA-256 `5285F90E1CA36546DEAF3616BA82AEC2BEA80E7D654DCDB6BE41C88B98BF6DE4`。
- 干净短路径构建树、实际包版本/ABI、v2 单签名、三份字体字节与哈希、黑胶资源核对通过。八个包内 source-map 源码模块逐字匹配构建树，APK JS 字节与生成 Hermes bundle 一致；原透明图案 PNG 的可见像素哈希、1254×1254 尺寸和 alpha=0 角落保持一致。
- 实际安装包证书与新包一致。在物理手机 `192.168.31.232:33325` 使用 `adb install -r` 保留数据升级自 `composition.20261012.230605` / `1791817566`，返回 Success。2026-10-13 09:06:58 +08:00 确认完整版本名与 code，然后停止全部设备操作；未自动打开应用、截屏、模拟器测试或执行手势。
- 明细 `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.hinge.20261013.090400-verification.json`。用户真机视觉/手势验收仍 `pending_user`；未以构建、安装或理想数学投影证明 GPU 视觉已通过。
