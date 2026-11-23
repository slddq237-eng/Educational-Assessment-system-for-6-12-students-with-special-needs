"""
改字型檔內部的名稱和授權欄位（docs/scripts/fontname.py，2026-11-23 加）

為什麼：我們用的注音字型是改作（切成只含課本生字的子集）自 But Ko 的 bpmfvs 字型，授權是 SIL Open Font License 1.1。
OFL 規定改作的版本不能沿用原作者保留的字型名稱，所以內部名稱改成本專案自己的；同時把原作者的著作權、授權欄位寫回去
（fonttools 切子集時會丟掉）。原作者的 NOTICE 全文放在 shared/fonts/NOTICE-bpmfvs.txt。
用法：make_bpmf.py、make_bpmf_only.py 存檔前呼叫 rename(font, '名稱', '改自哪一個字型')。
"""
FAMILY = 'EduAssess'

def rename(font, short, based_on):
    """short：例如 'Bpmf Only'；based_on：例如 'Bpmf Zihi Only（But Ko, bpmfvs）'"""
    family = f'{FAMILY} {short}'
    ps = (FAMILY + short).replace(' ', '')
    name = font['name']
    name.names = [r for r in name.names if r.nameID not in (0, 1, 2, 3, 4, 6, 13, 14, 16, 17, 21, 22, 25)]
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        for nid, s in ((0, f'Modified from {based_on}. Copyright But Ko and The Bpmf Project Authors (https://github.com/ButTaiwan/bpmfvs)'),
                       (1, family), (2, 'Regular'), (3, f'{ps}-Regular'), (4, f'{family} Regular'), (6, f'{ps}-Regular'),
                       (13, 'This Font Software is licensed under the SIL Open Font License, Version 1.1. This Font Software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.'),
                       (14, 'http://scripts.sil.org/OFL')):
            name.setName(s, nid, pid, eid, lid)
