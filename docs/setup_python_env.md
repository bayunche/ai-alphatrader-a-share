# Python 环境搭建与配置

## 1. 目标
为 `ai-alphatrader-a-share` 项目搭建 Python 运行环境，由于项目依赖 `akshare`、`flask` (后端服务) 以及 `pandas` (数据处理) 等库，需要独立且纯净的虚拟环境。

## 2. 步骤

### 2.1 环境工具准备
使用 `uv` 进行快速依赖安装与环境管理。

- 状态: **已完成**
- 命令: 
```powershell
pip install uv
```

### 2.2 创建虚拟环境
在项目根目录创建 `.venv`。

- 状态: **已完成**
- 命令:
```powershell
uv venv .venv
```

### 2.3 安装依赖
根据项目代码分析，安装以下核心依赖：
- `pandas`: 数据分析
- `requests`: 网络请求
- `akshare`: A股数据源
- `flask`: 后端 API 服务
- `pillow`: 图像处理 (用于 GUI 图标等)
- `nest_asyncio`, `aiohttp`: 异步支持 (推荐)
- `openpyxl`: Excel 支持 (可选)

- 状态: **已完成**
- 命令:
```powershell
uv pip install pandas requests akshare flask pillow nest_asyncio aiohttp openpyxl
```

### 2.4 验证
编写脚本验证核心库能否成功导入。

- 状态: **已完成**
- 结果: 所有依赖加载正常。

## 3. 使用说明
在 PowerShell 中激活环境：
```powershell
.\.venv\Scripts\Activate.ps1
```
或直接使用环境内的 Python 解释器：
```powershell
.\.venv\Scripts\python.exe server/index.js # (注意: Node.js 脚本中可能需要指定 python 路径或通过环境变量配置)
```
**注意**: 项目中的 `server/index.js` 也可以通过 `child_process` 调用的命令默认为 `python`，请确保在激活环境的终端中运行 Node 服务，或者修改配置指向 `.venv` Python。
