curl https://api.openai.com/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
    "model": "gpt-4o-2024-08-06",
    "messages": [
      {"role": "system", "content": "Extract the event information."},
      {"role": "user", "content": "Alice and Bob are going to a science fair on Friday."}
    ],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "calendar_event",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "name": {"type": "string", "description": "The name of the event"},
            "date": {"type": "string", "description": "The date of the event"},
            "participants": {
              "type": "array",
              "description": "List of participants",
              "items": {"type": "string"}
            }
          },
          "required": ["name", "date", "participants"],
          "additionalProperties": false
        }
      }
    }
  }'
