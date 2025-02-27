
curl https://api.openai.com/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
    "model": "gpt-4o-2024-08-06",
    "messages": [
      {"role": "system", "content": "You are a helpful math tutor. Guide the user through the solution step by step."},
      {"role": "user", "content": "How can I solve 8x + 7 = -23?"}
    ],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "math_reasoning",
        "strict": true,
        "schema": {
          "type": "object",
          "properties": {
            "steps": {
              "type": "array",
              "description": "Step-by-step explanations",
              "items": {
                "type": "object",
                "properties": {
                  "explanation": {"type": "string"},
                  "output": {"type": "string"}
                },
                "required": ["explanation", "output"],
                "additionalProperties": false
              }
            },
            "final_answer": {
              "type": "string",
              "description": "The final answer to the problem"
            }
          },
          "required": ["steps", "final_answer"],
          "additionalProperties": false
        }
      }
    }
  }'
