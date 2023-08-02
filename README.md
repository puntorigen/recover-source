# recover-source
CLI for recovering JS/TS source code given a directory with minified/uglified .js or .ts files with their respective sourcemap files. Returns the original files as they were before compilation.

# Install
1. clone the repo
2. issue: 
```bash
npm link
```
3. use the command:
```bash
recover-source -i <path-to-directory-with-minified-files>
```