# No open SSH

## Policy

SSH cannot be open from the world.

## Source Data

### System Initiative

```yaml
all-vpc: "schema:\"AWS::EC2::SecurityGroup\""
```

## Output Tags

```yaml
tags:
  - networking
  - security
```

