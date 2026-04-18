import subprocess
try:
    with open("docker_logs_temp.txt", "w", encoding="utf-8") as f:
        output = subprocess.check_output(['docker', 'logs', 'quanlisan-api-1'], stderr=subprocess.STDOUT)
        f.write(output.decode('utf-8'))
except Exception as e:
    print(e)
