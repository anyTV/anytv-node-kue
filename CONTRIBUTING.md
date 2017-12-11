# Contributing Guidelines
- When submitting a PR,
  - If it is a fix, add a test to catch the bug.
  - If it is a feature, of course still add a test and don't forget to update the documentation.
  - If it is a documentation update, please make sure to double check your grammar.
  - If it is a breaking change, at the very least, create a ticket for updating affected projects.
- Do not forget to update the package version.

## Setup
```bash
npm install
```

## Build
```bash
npm run build
```

## Test
> `npm test` will always build the library before running tests.
```bash
npm test
```

## Publishing
```bash
git tag -a <version> -m 'brief description for the new version changes'
npm login
npm publish
```

## Documentation
```bash
npm run docs
open docs/index.html
```
