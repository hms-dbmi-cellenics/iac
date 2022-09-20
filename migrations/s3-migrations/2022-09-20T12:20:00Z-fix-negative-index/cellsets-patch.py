import json
import sys
import os
from collections import Counter

cs = json.load(open('cellSets.json'))
os.rename('cellSets.json', 'cellSets.json.orig')

set_ids = set()
counts = Counter()
for elem in cs['cellSets']:
    for child in elem['children']:
        cell_ids = child['cellIds']
        set_ids.update(cell_ids)
        counts.update(cell_ids)

# check if the data contains -1
min_idx = min(set_ids)
if min_idx > 0:
    print(f'[SKIP] Min index is {min_idx}, exiting')
    sys.exit(0)

# update the indices adding +1
for elem in cs['cellSets']:
    for child in elem['children']:
        child['cellIds'] = [x+1 for x in child['cellIds']]

# count the elems again for verification
counts_updated = Counter()
set_ids_updated = set()
for elem in cs['cellSets']:
    for child in elem['children']:
        cell_ids = child['cellIds']
        set_ids_updated = cell_ids
        counts_updated.update(cell_ids)


# verify that the all the new counts are shifted by 1
if False in [counts[i] == counts_updated[i+1] for i in range(0, len(counts)-1)]:
    print(f'[FAIL] Differing counts exiting...')
    sys.exit(1)

# verify that the resulting total ids are the same
if [x+1 for x in list(set_ids)].sort() != set_ids_updated.sort():
    print(f'[FAIL] Differing ids exiting...')
    sys.exit(1)