import json
import sys
import os
from collections import Counter

experiment_id = sys.argv[1]

in_file_path = f"./in/{experiment_id}/cellsets.json"
out_file_path = f"./out/{experiment_id}/cellsets.json"

cs = json.load(open(in_file_path))

set_ids = set()
counts = Counter()
for cell_class in cs['cellSets']:
    for cell_set in cell_class['children']:
        if (cell_set["rootNode"] == None):
            cell_set["rootNode"] = False
        if (cell_set["type"] == None):
            cell_set["type"] = cell_class["type"]


out_file = open(out_file_path, "w+")

json.dump(cs, out_file, separators=(',', ':'))
