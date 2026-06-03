import os
import boto3
import datetime
from botocore.exceptions import ClientError

s3 = boto3.client("s3")

BUCKET = os.environ["S3_BUCKET"]
KEY = os.environ["S3_KEY"]


def backup_env():
    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        s3.copy_object(
            Bucket=BUCKET,
            CopySource={'Bucket': BUCKET, 'Key': KEY},
            Key=f"{KEY}_{timestamp}"
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            pass
        else:
            raise


def read_env():
    try:
        response = s3.get_object(
            Bucket=BUCKET,
            Key=KEY
        )

        content = response["Body"].read().decode("utf-8")

    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return {}

        raise

    result = {}

    for line in content.splitlines():
        line = line.strip()

        if not line or line.startswith("#"):
            continue

        if "=" not in line:
            continue

        k, v = line.split("=", 1)
        result[k.strip()] = v.strip()

    return result


def write_env(data):
    content = "\n".join(
        f"{k}={v}"
        for k, v in sorted(data.items())
    )

    s3.put_object(
        Bucket=BUCKET,
        Key=KEY,
        Body=content.encode("utf-8"),
        ContentType="text/plain"
    )