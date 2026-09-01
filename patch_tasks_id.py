import re

with open('server/routes/tasks.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'allDeviceIds = device_ids.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));',
    'allDeviceIds = device_ids;'
)

code = code.replace(
    'allDeviceIds = [parseInt(device_id, 10)].filter((id: number) => !isNaN(id));',
    'allDeviceIds = [device_id];'
)

with open('server/routes/tasks.ts', 'w', encoding='utf-8') as f:
    f.write(code)
