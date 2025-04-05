# CrewAI、LangChain、LlamaIndexの統合

## 概要

ユーザーが現在使用している以下のAIエージェントフレームワークの統合方法と、React Flowとの連携について調査しました：

- **CrewAI**: エージェント間の協調オーケストレーション
- **LangChain**: ツール統合とエージェント実装
- **LlamaIndex**: 情報検索と構造化

これらのフレームワークは相互に連携可能で、React Flowを使用して視覚的なワークフローインターフェースを構築できます。

## CrewAIとLlamaIndexの統合

CrewAIはLlamaIndexのツールを簡単に統合できる機能を提供しています。

### 基本的な統合方法

```python
from crewai import Agent
from crewai_tools import LlamaIndexTool
from llama_index.core.tools import FunctionTool

# 1. LlamaIndexのFunctionToolを作成
your_python_function = lambda ...: ...
og_tool = FunctionTool.from_defaults(
    your_python_function,
    name="<name>",
    description='<description>'
)

# 2. LlamaIndexToolに変換
tool = LlamaIndexTool.from_tool(og_tool)

# 3. CrewAIのエージェントにツールを追加
agent = Agent(
    role='Research Analyst',
    goal='Provide up-to-date market analysis',
    backstory='An expert analyst with a keen eye for market trends.',
    tools=[tool]
)
```

### クエリエンジンの統合

```python
# LlamaIndexのクエリエンジンをCrewAIのツールとして使用
query_engine = index.as_query_engine()
query_tool = LlamaIndexTool.from_query_engine(
    query_engine,
    name="Document Query Tool",
    description="Use this tool to lookup information in the document database"
)

# エージェントにツールを追加
agent = Agent(
    role='Research Analyst',
    goal='Provide up-to-date market analysis',
    backstory='An expert analyst with a keen eye for market trends.',
    tools=[query_tool]
)
```

### LlamaHubツールの統合

```python
from llama_index.tools.wolfram_alpha import WolframAlphaToolSpec

# WolframAlphaツールの設定
wolfram_spec = WolframAlphaToolSpec(app_id="<app_id>")
wolfram_tools = wolfram_spec.to_tool_list()

# ツールリストをLlamaIndexToolに変換
tools = [LlamaIndexTool.from_tool(t) for t in wolfram_tools]

# エージェントにツールを追加
agent = Agent(
    role='Research Analyst',
    goal='Provide up-to-date market analysis',
    backstory='An expert analyst with a keen eye for market trends.',
    tools=tools
)
```

## CrewAIとLangChainの統合

CrewAIはLangChainのツールも簡単に統合できます。

### 基本的な統合方法

```python
import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew
from crewai.tools import BaseTool
from pydantic import Field
from langchain_community.utilities import GoogleSerperAPIWrapper

load_dotenv()
search = GoogleSerperAPIWrapper()

# LangChainツールをCrewAIで使用するためのラッパークラス
class SearchTool(BaseTool):
    name: str = "Search"
    description: str = "Useful for search-based queries. Use this to find current information about markets, companies, and trends."
    search: GoogleSerperAPIWrapper = Field(default_factory=GoogleSerperAPIWrapper)

    def _run(self, query: str) -> str:
        """Execute the search query and return results"""
        try:
            return self.search.run(query)
        except Exception as e:
            return f"Error performing search: {str(e)}"

# エージェントにツールを追加
researcher = Agent(
    role='Research Analyst',
    goal='Gather current market data and trends',
    backstory="""You are an expert research analyst with years of experience in gathering market intelligence. You're known for your ability to find relevant and up-to-date market information and present it in a clear, actionable format.""",
    tools=[SearchTool()],
    verbose=True
)
```

### LangChainのツールリストの統合

CrewAIは、LangChainの包括的なツールリストと統合できます。これにより、様々なAPIやサービスにアクセスできます。

## 複数フレームワークの連携例

以下は、CrewAI、LangChain、LlamaIndexを組み合わせた実装例です：

```python
import os
from crewai import Agent, Task, Crew, Process
from crewai_tools import LlamaIndexTool
from langchain_community.utilities import GoogleSerperAPIWrapper
from crewai.tools import BaseTool
from pydantic import Field
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.tools import FunctionTool

# LangChainのSearchツール
class SearchTool(BaseTool):
    name: str = "Search"
    description: str = "Useful for search-based queries."
    search: GoogleSerperAPIWrapper = Field(default_factory=GoogleSerperAPIWrapper)

    def _run(self, query: str) -> str:
        try:
            return self.search.run(query)
        except Exception as e:
            return f"Error performing search: {str(e)}"

# LlamaIndexのドキュメント検索ツール
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
document_tool = LlamaIndexTool.from_query_engine(
    query_engine,
    name="Document Search",
    description="Search for information in the document database."
)

# カスタム関数ツール
def calculate_metrics(data: str) -> str:
    # メトリクス計算ロジック
    return f"Calculated metrics: {data}"

calc_tool = FunctionTool.from_defaults(
    calculate_metrics,
    name="Calculate Metrics",
    description="Calculate metrics from provided data."
)
llamaindex_calc_tool = LlamaIndexTool.from_tool(calc_tool)

# エージェントの定義
researcher = Agent(
    role='Research Analyst',
    goal='Gather and analyze market data',
    backstory='Expert in finding and analyzing market information.',
    tools=[SearchTool(), document_tool]
)

analyst = Agent(
    role='Data Analyst',
    goal='Analyze data and provide insights',
    backstory='Expert in data analysis and visualization.',
    tools=[llamaindex_calc_tool]
)

# タスクの定義
research_task = Task(
    description="Research the latest market trends",
    agent=researcher
)

analysis_task = Task(
    description="Analyze the research data and provide insights",
    agent=analyst
)

# クルーの定義と実行
crew = Crew(
    agents=[researcher, analyst],
    tasks=[research_task, analysis_task],
    process=Process.sequential
)

result = crew.kickoff()
```

## LlamaIndexのRAG機能の活用

LlamaIndexは特に検索拡張生成（RAG）に強みを持っており、CrewAIエージェントと組み合わせることで、ドキュメントベースの質問応答システムを構築できます。

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from crewai import Agent
from crewai_tools import LlamaIndexTool

# ドキュメントの読み込みとインデックス作成
documents = SimpleDirectoryReader("./data").load_data()
index = VectorStoreIndex.from_documents(documents)

# クエリエンジンの作成
query_engine = index.as_query_engine()

# LlamaIndexツールの作成
document_tool = LlamaIndexTool.from_query_engine(
    query_engine,
    name="Document Search",
    description="Search for information in the document database."
)

# エージェントの定義
agent = Agent(
    role='Research Assistant',
    goal='Answer questions based on the document database',
    backstory='Expert in retrieving and synthesizing information from documents.',
    tools=[document_tool]
)
```

## まとめ

CrewAI、LangChain、LlamaIndexは相互に連携可能で、それぞれの強みを活かした統合が可能です：

1. **CrewAI**: マルチエージェントの協調とオーケストレーションを担当
2. **LangChain**: 外部ツールやAPIとの統合、エージェントの実装を提供
3. **LlamaIndex**: 情報検索と構造化、特にRAG（検索拡張生成）に強み

これらのフレームワークを組み合わせることで、情報収集、分析、ナレッジグラフ更新などの複雑なワークフローを実現できます。次のセクションでは、これらのフレームワークとReact Flowを統合する方法について説明します。
