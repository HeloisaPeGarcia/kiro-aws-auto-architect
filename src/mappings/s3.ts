import { S3MethodMapping } from '../types';

export const S3_MAPPINGS: Readonly<Record<string, S3MethodMapping>> = {
  // ─── .NET C# (Amazon.S3) ──────────────────────────────────────────────────
  GetObjectAsync:        { iamActions: ['s3:GetObject'],    targetType: 'object' },
  PutObjectAsync:        { iamActions: ['s3:PutObject'],    targetType: 'object' },
  DeleteObjectAsync:     { iamActions: ['s3:DeleteObject'], targetType: 'object' },
  ListObjectsV2Async:    { iamActions: ['s3:ListBucket'],   targetType: 'bucket' },
  ListObjectsAsync:      { iamActions: ['s3:ListBucket'],   targetType: 'bucket' },
  GetPreSignedURL:       { iamActions: ['s3:GetObject'],    targetType: 'object' },
  CopyObjectAsync:       { iamActions: ['s3:GetObject', 's3:PutObject'], targetType: 'object' },

  // ─── Python boto3 ──────────────────────────────────────────────────────────
  get_object:            { iamActions: ['s3:GetObject'],    targetType: 'object' },
  put_object:            { iamActions: ['s3:PutObject'],    targetType: 'object' },
  upload_file:           { iamActions: ['s3:PutObject'],    targetType: 'object' },
  download_file:         { iamActions: ['s3:GetObject'],    targetType: 'object' },
  delete_object:         { iamActions: ['s3:DeleteObject'], targetType: 'object' },
  list_objects_v2:       { iamActions: ['s3:ListBucket'],   targetType: 'bucket' },
  list_objects:          { iamActions: ['s3:ListBucket'],   targetType: 'bucket' },
  generate_presigned_url:{ iamActions: ['s3:GetObject'],    targetType: 'object' },
  copy_object:           { iamActions: ['s3:GetObject', 's3:PutObject'], targetType: 'object' },
} as const;

/** Namespaces que indicam uso real da SDK S3 em C# */
export const S3_CSHARP_NAMESPACES = [
  'Amazon.S3',
  'IAmazonS3',
  'AmazonS3Client',
] as const;
