export function buildApiDocs(baseUrl: string) {
  return `# Prepped API

Base URL: ${baseUrl}

Authentication:
- Create a personal API token from ${baseUrl}/profile
- Send it as: Authorization: Bearer YOUR_TOKEN
- Session cookies also work for the same endpoints when you are logged in through the browser

Endpoint: POST /api/v1/recipes

Purpose:
- Create a recipe in the authenticated user's account
- Optional AI cleanup is available with "aiEnhance": true

Request headers:
- Content-Type: application/json
- Authorization: Bearer YOUR_TOKEN

Core fields:
- title: string, required
- ingredients: required
- steps: required
- description: string, optional
- servings: number, optional
- prepTime: number, optional, minutes
- cookTime: number, optional, minutes
- difficulty: "easy" | "medium" | "hard", optional
- notes: string, optional
- sourceUrl: string, optional
- videoUrl: string, optional
- imageUrl: string, optional
- isPublished: boolean, optional, defaults to true
- tagIds: number[], optional
- collectionIds: number[], optional
- tags: string[], optional
- collections: string[], optional
- aiEnhance: boolean, optional

Structured create example:
\`\`\`json
{
  "title": "Simple Tomato Pasta",
  "ingredients": [
    { "amount": "250", "unit": "g", "name": "spaghetti" },
    { "amount": "400", "unit": "g", "name": "tomatoes" },
    { "amount": "2", "unit": "", "name": "garlic cloves" }
  ],
  "steps": [
    { "order": 1, "instruction": "Boil the pasta until al dente." },
    { "order": 2, "instruction": "Cook the tomatoes and garlic, then toss with pasta." }
  ],
  "tags": ["pasta", "quick dinner"]
}
\`\`\`

AI-enhanced create example:
\`\`\`json
{
  "title": "Simple Tomato Pasta",
  "ingredients": [
    "250 g spaghetti",
    "400 g tomatoes",
    "2 garlic cloves"
  ],
  "steps": [
    "Boil the pasta until al dente.",
    "Cook the tomatoes and garlic, then toss with pasta."
  ],
  "tags": ["pasta", "quick dinner"],
  "collections": ["🍝 Pasta"],
  "aiEnhance": true
}
\`\`\`

Behavior when aiEnhance is true:
- ingredients may be objects or plain strings
- steps may be objects or plain strings
- the server will normalize ingredient names, steps, supplies, and optional tags/collections
- the result is still saved as a normal structured recipe

Behavior when aiEnhance is false:
- ingredients must already be objects with amount, unit, and name
- steps must already be objects with order and instruction
- tags and collections can still be sent as names or ids

Success response:
- HTTP 201
- JSON body is the created recipe row, including id and slug

Error responses:
- 400: invalid JSON body or unsupported field shape
- 401: missing or invalid auth
- 4xx/5xx from AI provider: only possible when aiEnhance is true
`;
}
