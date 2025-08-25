import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.SIMPLE_SERVER_PORT || 8080;

// Serve static files from workspace
app.use(express.static('/workspace'));

// Handle JavaScript execution
app.get('/run/:filename', async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join('/workspace', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    try {
        const { stdout, stderr } = await execAsync(`node "${filePath}"`, { cwd: '/workspace' });
        res.json({ 
            output: stdout, 
            error: stderr,
            success: true 
        });
    } catch (error: any) {
        res.json({ 
            output: '', 
            error: error.message || 'Execution failed',
            success: false 
        });
    }
});

// Serve index.html for SPA routing
app.get('*', (req, res) => {
    const indexPath = path.join('/workspace', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        // Create a simple HTML page that shows workspace contents
        const files = fs.readdirSync('/workspace').filter(f => !f.startsWith('.'));
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Workspace: ${process.env.REPL_ID || 'Unknown'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
                    .file { padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; }
                    .file a { color: #007bff; text-decoration: none; }
                    .file a:hover { text-decoration: underline; }
                    .run-btn { background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px; }
                    .run-btn:hover { background: #218838; }
                    .output { background: #f8f9fa; padding: 10px; margin-top: 10px; border-radius: 4px; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Workspace Files</h1>
                    <div id="files">
                        ${files.map(file => `
                            <div class="file">
                                <a href="/${file}" target="_blank">${file}</a>
                                ${file.endsWith('.js') ? `<button class="run-btn" onclick="runFile('${file}')">Run</button>` : ''}
                                <div id="output-${file}" class="output" style="display: none;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <script>
                    async function runFile(filename) {
                        const outputDiv = document.getElementById('output-' + filename);
                        outputDiv.style.display = 'block';
                        outputDiv.textContent = 'Running...';
                        
                        try {
                            const response = await fetch('/run/' + filename);
                            const result = await response.json();
                            
                            if (result.success) {
                                outputDiv.textContent = 'Output:\\n' + result.output;
                                if (result.error) {
                                    outputDiv.textContent += '\\nErrors:\\n' + result.error;
                                }
                            } else {
                                outputDiv.textContent = 'Error:\\n' + result.error;
                            }
                        } catch (error) {
                            outputDiv.textContent = 'Failed to run: ' + error.message;
                        }
                    }
                </script>
            </body>
            </html>
        `;
        res.send(html);
    }
});

app.listen(PORT, () => {
    console.log(`Simple server listening on port ${PORT}`);
});
