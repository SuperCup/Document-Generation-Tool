# 快速修复SSH连接问题

## 问题
```
C:\\Users\\PC/.ssh/config line 3: Bad port 'SuperCup/Standard-Business-Process-Management.git'.
```

## 快速解决方法（30秒）

### 方法1：使用批处理脚本（最简单）

**双击运行：`快速修复SSH.bat`**

脚本会自动备份并重命名有问题的配置文件。

---

### 方法2：手动命令（如果脚本不工作）

在PowerShell中运行：

```powershell
Rename-Item $env:USERPROFILE\.ssh\config $env:USERPROFILE\.ssh\config.backup
```

然后就可以连接服务器了：

```powershell
ssh root@8.134.59.82
```

---

## 说明

你的SSH配置文件中 `Port` 字段被错误设置成了Git仓库路径：
```
Port SuperCup/Standard-Business-Process-Management.git  ❌ 错误
```

正确应该是：
```
Port 22  ✅ 正确
```

临时重命名配置文件后，SSH会使用默认配置（端口22），可以正常连接。

---

## 连接服务器

修复后，运行：

```powershell
ssh root@8.134.59.82
```

首次连接会提示确认，输入 `yes`，然后输入root密码即可。

---

## 如果需要恢复配置文件

（通常不需要，除非你确实需要原来的配置）

```powershell
Rename-Item $env:USERPROFILE\.ssh\config.backup config
```

然后需要手动修复配置文件中的Port字段。

