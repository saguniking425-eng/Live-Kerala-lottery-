import { exec } from 'child_process';
exec(`python3 check_env.py`, (error, stdout, stderr) => {
    if (error) {
        console.error(error);
    }
    console.log("STDOUT", stdout);
    console.error("STDERR", stderr);
});
