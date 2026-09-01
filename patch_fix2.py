import re

with open('src/pages/TasksPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

legacy_block = """                                    {item.input_type === 'OPTION' && (() => {
                                      let opts: string[] = [];
                                      try {
                                        opts = item.options_json ? JSON.parse(item.options_json) : [];
                                      } catch(e) {}
                                      return (
                                        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                          {opts.map((opt: string) => (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() =>
                                                setItemResults(prev => ({
                                                  ...prev,
                                                  [resKeyLegacy]: { ...prev[resKeyLegacy], is_pass: true, result_value: opt }
                                                }))
                                              }
                                              className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                                                resVal.result_value === opt
                                                  ? 'bg-blue-600 text-white shadow-xs'
                                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                              }`}
                                            >
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    })()}
"""

code = code.replace("                                    {item.input_type === 'PASS_FAIL' && (", legacy_block + "                                    {item.input_type === 'PASS_FAIL' && (")

with open('src/pages/TasksPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

