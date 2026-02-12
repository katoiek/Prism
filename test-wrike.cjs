const { spawn } = require('child_process');
const path = require('path');

const cmd = path.resolve('node_modules/.bin/mcp-remote');
const args = [
	'https://www.wrike.com/app/mcp/sse',
	'--header',
	'Authorization:Bearer eyJ0dCI6InAiLCJhbGciOiJIUzI1NiIsInR2IjoiMiJ9.eyJkIjoie1wiYVwiOjI5NTU0MzYsXCJpXCI6OTU4NDI0OSxcImNcIixcIjQ2OTM2MjksXCJ1XCI6NzgyMTg4OCxcInJcIjpcIlVTV1wiLFwic1wiOltcIldcIixcIkZcIixcIklcIixcIlVcIixcIktcIixcIkNcIixcIkRcIixcIk1cIixcIkFcIixcIkxcIixcIlBcIl0sXCJ6XCI6W10sXCJ0XCI6MH0iLCJpYXQiOjE3NjUzMzI2MzV9.k-NCuajOBtyRxPF7fgvCSdSnEDu_WVJuZlcc9W2IOG0'
];

console.log(`Executing: ${cmd}`);

const child = spawn(cmd, args, { stdio: 'inherit' });

child.on('error', (err) => console.error('Failed to start:', err));
child.on('exit', (code) => console.log('Process exited with code:', code));
