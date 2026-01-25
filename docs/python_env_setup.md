# Python 环境搭建记录

## 1. 目标
初始化项目的 Python 运行环境，使用 `uv` 管理依赖，确保 `server/eastmoney.py` 和 `server/akshare_service.py` 可运行。

## 2. 步骤

### 2.1 检查工具
验证 `uv` 是否已安装。
```powershell
uv --version
# Output: uv 0.x.x
```

### 2.2 创建虚拟环境
在项目根目录建立 `.venv`。
```powershell
uv venv .venv
```

### 2.3 安装依赖
根据项目文件分析，安装核心依赖：
* `pandas` (数据处理)
* `requests` (API 请求)
* `akshare` (财经数据源)
* `flask` (微服务框架)
* `pillow` (图像处理，用于 `test.py`)

执行命令：
```powershell
uv pip install pandas requests akshare flask pillow
```

### 2.4 验证环境
运行后端单测脚本 `server/test_eastmoney.py` 验证环境可用性。
```powershell
uv run python server/test_eastmoney.py
```

## 3. 结果
* **状态**: ✅ 已完成
* **验证**: 5 个测试用例全部通过。
* **下一步**: 建议启动后端服务 `node server/index.js` (或修复 npm 构建问题)。
