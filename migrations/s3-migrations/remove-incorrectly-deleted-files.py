import boto3
from datetime import datetime

s3_client = boto3.client("s3")


def get_object_paginator(bucket):
    s3_client = boto3.client("s3")
    object_response_paginator = s3_client.get_paginator("list_object_versions")
    return object_response_paginator.paginate(Bucket=bucket)


def get_raw_objects(paginator):
    delete_markers = []
    versions = []

    for object_response_itr in paginator:
        if "DeleteMarkers" in object_response_itr:
            delete_markers.extend(object_response_itr["DeleteMarkers"])

        if "Versions" in object_response_itr:
            versions.extend(object_response_itr["Versions"])

    return delete_markers, versions


def get_elapsed_days(past_date):
    timezone = past_date.tzinfo
    today = datetime.now(timezone)
    delta = today - past_date
    return delta.days


# {
#     [deleteMarkerId1]: {
#         # "Wrong" delete marker means that the delete marker was applied to root directory
#         # instead of to each individual file within the directory
#         IsDeleteMarkerWrong: ...,
#         DeleteMarkerIsLatest: ...,
#         LastModified: ...,
#         ElapsedDays: ...,
#         Versions: [
#             {"Key": [deleteMarkerId1], "Version": [deleteMarkerVersionId1]},
#             {"Key": <key1>, "Version": <versionId1>},
#             {"Key": <key2>, "Version": <versionId2>},
#             ...
#         ]
#     },
#     ...
# }
def build_objects(delete_markers, versions, only_outdated=True):
    objects = {}
    wrong_objects = {}

    # Extract data from delete markers
    for delete_marker in delete_markers:
        elapsed_days = get_elapsed_days(delete_marker["LastModified"])
        delete_marker_latest = delete_marker["IsLatest"]
        if only_outdated:
            if not delete_marker_latest or elapsed_days < 5:
                continue

        version_key = {
            "Key": delete_marker["Key"],
            "Version": delete_marker["VersionId"],
        }

        object = {
            "IsDeleteMarkerWrong": False,
            "IsDeleteMarkerLatest": delete_marker_latest,
            "LastModififed": delete_marker["LastModified"],
            "ElapsedDays": elapsed_days,
            "Versions": [version_key],
        }
        objects[delete_marker["Key"]] = object

    # Match versions on delete marker key prefix
    for version in versions:
        prefix = version["Key"].split("/")[0]

        # Check if a delete marker exists for the object
        if version["Key"] in objects.keys():
            key = version["Key"]
        # Check if a delete marker exists for the parent directory
        elif prefix in objects.keys():
            key = prefix
        else:
            continue

        version_key = {
            "Key": version["Key"],
            "Version": version["VersionId"],
        }

        objects[key]["Versions"].append(version_key)
        is_object_wrong = objects[key]["IsDeleteMarkerLatest"]
        objects[key]["IsDeleteMarkerWrong"] = is_object_wrong
        if is_object_wrong:
            wrong_objects[key] = objects[key]
    return objects, wrong_objects


bucket = "biomage-source-staging-242905224710"

paginator = get_object_paginator(bucket)
delete_markers, versions = get_raw_objects(paginator)
objects, wrong_objects = build_objects(delete_markers, versions, only_outdated=True)

print(wrong_objects)

# for i in range(0, len(delete_marker_list), 1000):
#     response = s3_client.delete_objects(
#         Bucket=bucket,
#         Delete={
#             'Objects': delete_marker_list[i:i+1000],
#             'Quiet': True
#         }
#     )
#     print(response)

# for i in range(0, len(version_list), 1000):
#     response = s3_client.delete_objects(
#         Bucket=bucket,
#         Delete={
#             'Objects': version_list[i:i+1000],
#             'Quiet': True
#         }
#     )
#     print(response)
