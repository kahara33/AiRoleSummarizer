#!/bin/bash

# パターンを指定して置換
function update_call() {
  local line_number=$1
  local file=$2
  
  # 行を取得
  local line=$(sed -n "${line_number}p" "$file")
  
  # 必要な情報を抽出
  local message=$(echo "$line" | grep -oP "'[^']*'" | head -1 | tr -d "'")
  local progress=$(echo "$line" | grep -oP '\d+' | head -1)
  
  # 次の行から4行を取得して処理
  local data_block=$(sed -n "$((line_number+3)),$((line_number+6))p" "$file")
  local sub_message=$(echo "$data_block" | grep "message:" | grep -oP "'[^']*'" | head -1 | tr -d "'")
  local stage=$(echo "$data_block" | grep "stage:" | grep -oP "'[^']*'" | head -1 | tr -d "'")
  local sub_stage=$(echo "$data_block" | grep "subStage:" | grep -oP "'[^']*'" | head -1 | tr -d "'")
  
  if [ -z "$sub_message" ]; then
    sub_message="$message"
  fi
  
  # 新しい呼び出しを構築
  local new_call="      this.reportProgress(\n        '$sub_message',\n        $progress,\n        '$stage',\n        '$sub_stage'\n      );"
  
  # 置換を実行
  sed -i "${line_number},$((line_number+8))c\\${new_call}" "$file"
}

# 特定のsendProgressUpdate呼び出しに対して置換を実行
update_call 105 server/agents/planner-agent.ts
update_call 172 server/agents/planner-agent.ts
update_call 204 server/agents/planner-agent.ts
update_call 232 server/agents/planner-agent.ts
update_call 260 server/agents/planner-agent.ts
update_call 347 server/agents/planner-agent.ts
update_call 375 server/agents/planner-agent.ts
update_call 514 server/agents/planner-agent.ts
update_call 546 server/agents/planner-agent.ts

echo "置換が完了しました"
