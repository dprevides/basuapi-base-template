export const swcJson = {
    "jsc": {
      "parser": {
        "syntax": "typescript",
        "tsx": false,
        "decorators": true,
        "dynamicImport": true
      },
      "target": "es2020",
      "paths": {
        "@app/*": ["./app/*"]
      },
      "baseUrl": "."
    },
    "module": {
      "type": "commonjs"
    }
  }