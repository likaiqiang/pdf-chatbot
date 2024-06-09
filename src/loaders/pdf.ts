import filepath from 'path';
import fs from 'fs'
import {PythonShell} from 'python-shell';
import { Document } from "@/types/document";

// eslint-disable-next-line
const pythonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_source','python') : filepath.join(__dirname,'python_source','python')
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','semantic_splitter.py') : filepath.join(__dirname,'python_code','semantic_splitter.py')

class PDFLoader {
    async parse(path:string): Promise<Document<Record<string, any>>[]>{
        const now = Date.now()
        const jsonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','result',`semantic_splitter_${now}.json`) : filepath.join(__dirname,'python_code','result',`semantic_splitter_${now}.json`)
        return PythonShell.run(scriptPath, {
            pythonPath,
            pythonOptions: ['-u'],
            args:["--path", path, '--write_path', jsonPath]
        }).then(()=>{
            const messages:Document[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '[]')
            fs.unlinkSync(jsonPath)
            return messages.map(message=>{
                return new Document({
                    pageContent: message.pageContent,
                    metadata: {
                        ...message.metadata,
                        source: path
                    }
                })
            })
        }).catch(err=>{
            console.log(err);
        })
    }
}
export default PDFLoader
