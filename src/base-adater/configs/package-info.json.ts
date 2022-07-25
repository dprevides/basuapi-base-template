export const packageInfoJson = {
    "name": "adapter",
    "version": "1.0.7",
    "main": "index.js",
    "license": "MIT",
    "dependencies": {
        "express": "^4.18.1",
        "@basuapi/api": "latest",
    },
    "scripts": {
        "app:install": "cp -fr ../prisma . 2>/dev/null || : && swc src -d api && yarn create:public:folder",
        "build": "swc src -d api && yarn create:public:folder",
        "create:public:folder": "mkdir -p public && cp -fr api ./public && cp -fr app ./public && cp -fr package.json ./public && cp -fr node_modules ./public && cp -fr vercel.json ./public",
        "vercel-build": "yarn build",
        "clean": "rm -rf api",
    },    
    "devDependencies": {
      "typescript": "^4.7.4",
      "@swc/cli": "^0.1.57",
      "@swc/core": "^1.2.215",
      "@tsconfig/node17": "^1.0.1",
      "@types/bcrypt": "^5.0.0",
      "@types/express": "^4.17.13",
      "@types/fs-extra": "^9.0.13",
      "@types/jest": "^28.1.6",
      "@types/jsonwebtoken": "^8.5.8",
      "concurrently": "^7.2.2",
      "jest": "^28.1.3",
      "nodemon": "^2.0.19",
      "ts-jest": "^28.0.7",                    
    }   
}