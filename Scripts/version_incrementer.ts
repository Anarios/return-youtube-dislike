import { options } from '../options';
import fs = require('fs');

const getFileContent = (filePath: string) => {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error("Read failed: File not found!");
        process.exit(1);
    }
};

const extensionManifestFilePath = options.manifest_path;

const extensionManifestContent = JSON.parse(getFileContent(extensionManifestFilePath));
const packageJsonContent = JSON.parse(getFileContent("package.json"));

extensionManifestContent["version"] = packageJsonContent["version"];

try {
    fs.writeFileSync(extensionManifestFilePath, JSON.stringify(extensionManifestContent, null, 2) + "\n");
} catch (error) {
    console.error("Write failed: File not found!");
}
