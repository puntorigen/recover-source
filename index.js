#!/usr/bin/env node
const fs = require('fs');
const { SourceMapConsumer } = require('source-map');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const prettier = require('prettier');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('input', {
        description: 'The input path to the minified JavaScript file or a directory containing multiple files',
        alias: 'i',
        type: 'string',
        demandOption: true
    })
    .help()
    .alias('help', 'h')
    .argv;

const handleFile = async (minifiedFilePath) => {
    // Check if the Source Map exists
    const sourceMapPath = minifiedFilePath + '.map';
    if (!fs.existsSync(sourceMapPath)) {
        console.error(`No source map found at ${sourceMapPath}`);
        return;
    }

    // Read the minified file and the Source Map
    const minifiedCode = fs.readFileSync(minifiedFilePath, 'utf8');
    const rawSourceMap = fs.readFileSync(sourceMapPath);
    const rawSourceMapJson = JSON.parse(rawSourceMap);

    await SourceMapConsumer.with(rawSourceMapJson, null, (sourceMapConsumer) => {
        const sources = sourceMapConsumer.sources;

        const sourceContents = sources.reduce((contents, source) => {
            contents[source] = sourceMapConsumer.sourceContentFor(source, true);
            return contents;
        }, {});

        if (Object.values(sourceContents).some(content => content !== null)) {
            // If sourcesContent exists, write it to the file
            for (const source in sourceContents) {
                if (sourceContents[source] !== null) {
                    const originalFilePath = path.join(path.dirname(minifiedFilePath), path.basename(source, '.js') + '');
                    fs.mkdirSync(path.dirname(originalFilePath), { recursive: true });
                    try {
                        await fs.promises.writeFile(originalFilePath, sourceContents[source]);
                        console.log(`Source code recovered to ${originalFilePath}`);
                    } catch (error) {
                        console.error(`Error saving file ${originalFilePath}:`, error);
                    }
                }
            }
        } else {
            // If sourcesContent doesn't exist, reconstruct the source code
            const lines = minifiedCode.split('\n');
            let reconstructedSource = '';

            lines.forEach((line, lineIndex) => {
                const lineNum = lineIndex + 1;
                const columnCount = line.length;

                for (let column = 0; column < columnCount; column++) {
                    const pos = { line: lineNum, column: column };
                    const originalPosition = sourceMapConsumer.originalPositionFor(pos);

                    if (originalPosition.source === null) continue;

                    if (originalPosition.name) {
                        reconstructedSource += originalPosition.name;
                    } else {
                        reconstructedSource += minifiedCode.charAt(column);
                    }
                }

                reconstructedSource += '\n';
            });

            // prettify the code
            try {
                reconstructedSource = prettier.format(reconstructedSource, { semi: false, parser: "babel" });
            } catch (error) {
                console.error("An error occurred while prettifying the code:", error);
            }

            const originalFilePath = path.join(path.dirname(minifiedFilePath), path.basename(minifiedFilePath, '.js') + '-recovered.js');
            fs.mkdirSync(path.dirname(originalFilePath), { recursive: true });
            try {
                await fs.promises.writeFile(originalFilePath, reconstructedSource);
                console.log(`Source code recovered to ${originalFilePath}`);
            } catch (error) {
                console.error(`Error saving file ${originalFilePath}:`, error);
            }
        }
    });
};

const handlePath = (inputPath) => {
    const files = fs.readdirSync(inputPath);

    for (const file of files) {
        const absolutePath = path.join(inputPath, file);

        if (fs.statSync(absolutePath).isDirectory()) {
            handlePath(absolutePath);
        } else if (path.extname(absolutePath) === '.js') {
            handleFile(absolutePath);
        }
    }
};

if (fs.statSync(argv.input).isDirectory()) {
    handlePath(argv.input);
} else {
    handleFile(argv.input);
}
