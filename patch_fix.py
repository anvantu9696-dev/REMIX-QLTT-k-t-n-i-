import re

with open('src/pages/TasksPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# I will find the incorrect OPTION block and remove it.
# The incorrect block is between 1910 and 1938 and ends before "item.input_type === 'PASS_FAIL'"
# Let's just use regex to remove it from the multi-device block.

multi_device_incorrect = r"                                                                              \{item\.input_type === 'OPTION'.*?\[resKeyLegacy\].*?\}\)\(\)\}"
code = re.sub(multi_device_incorrect, "", code, flags=re.DOTALL)

with open('src/pages/TasksPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

