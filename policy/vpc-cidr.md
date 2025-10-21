# All VPCs in the 10 CIDR block

## Policy

All the VPCs must be in the 10 CIDR block, and not have overlapping addresses.

### Exceptions

The default VPC (sandbox) is allowed to be the 172.31 CIDR block.

## Source Data

### System Initiative

```yaml
all-vpc: "schema:\"AWS::EC2::VPC\""
```

## Output Tags

```yaml
tags:
  - networking
```
