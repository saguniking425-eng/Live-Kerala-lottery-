import { execSync } from 'child_process';
try {
  const result = execSync(`python3 check_env_vars.py`);
  console.log(result.toString());
} catch (e: any) {
  console.error(e.stdout?.toString(), e.stderr?.toString());
}
