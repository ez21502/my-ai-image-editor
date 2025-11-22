#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
环境变量验证脚本
检查 .env.local 文件中的环境变量是否有效
"""

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# 修复 Windows 控制台编码问题
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 必需的后端环境变量
REQUIRED_BACKEND_VARS = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_BOT_USERNAME',
    'MAKE_WEBHOOK_URL',
    'APP_BASE_URL',
]

# 可选的前端环境变量
OPTIONAL_FRONTEND_VARS = [
    'VITE_PAYMENTS_BASE_URL',
    'VITE_MAKE_WEBHOOK_URL',
    'VITE_TELEGRAM_BOT_USERNAME',
    'VITE_DEV_MODE',
    'VITE_ALLOW_NON_TELEGRAM',
]

# 验证规则
VALIDATION_RULES = {
    'SUPABASE_URL': {
        'pattern': r'^https://[a-zA-Z0-9-]+\.supabase\.co$',
        'description': '应该是 Supabase 项目 URL，格式：https://xxx.supabase.co'
    },
    'SUPABASE_SERVICE_ROLE_KEY': {
        'pattern': r'^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$',
        'description': '应该是 JWT token 格式'
    },
    'TELEGRAM_BOT_TOKEN': {
        'pattern': r'^\d+:[a-zA-Z0-9_-]+$',
        'description': '应该是 Telegram Bot Token 格式：数字:字符串'
    },
    'TELEGRAM_BOT_USERNAME': {
        'pattern': r'^@?[a-zA-Z0-9_]+$',
        'description': '应该是 Bot 用户名，格式：@username 或 username'
    },
    'MAKE_WEBHOOK_URL': {
        'pattern': r'^https?://.+',
        'description': '应该是有效的 HTTP/HTTPS URL'
    },
    'APP_BASE_URL': {
        'pattern': r'^https?://.+',
        'description': '应该是有效的 HTTP/HTTPS URL'
    },
    'VITE_PAYMENTS_BASE_URL': {
        'pattern': r'^(https?://.+|/api|)$',
        'description': '应该是完整的 URL 或相对路径 /api，或留空'
    },
}

def load_env_file(file_path: Path) -> Dict[str, str]:
    """加载 .env.local 文件"""
    env_vars = {}
    if not file_path.exists():
        return env_vars
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            
            # 解析 KEY=VALUE
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                env_vars[key] = value
    
    return env_vars

def validate_value(key: str, value: str) -> Tuple[bool, str]:
    """验证单个环境变量的值"""
    if not value or value == '':
        return False, '值为空'
    
    # 检查占位符
    placeholder_keywords = ['your_', 'Make.com Webhook URL', 'your_value_here', 'your_', 'placeholder']
    if any(keyword in value for keyword in placeholder_keywords):
        return False, '值为占位符，需要替换为实际值'
    
    # 检查是否有验证规则
    if key in VALIDATION_RULES:
        rule = VALIDATION_RULES[key]
        pattern = rule['pattern']
        if not re.match(pattern, value):
            return False, f"格式不正确：{rule['description']}"
    
    return True, '有效'

def check_env_vars():
    """检查环境变量"""
    env_file = Path('.env.local')
    
    print("=" * 60)
    print("环境变量验证")
    print("=" * 60)
    print(f"\n检查文件: {env_file.absolute()}")
    
    if not env_file.exists():
        print("\n[ERROR] 错误: .env.local 文件不存在！")
        print("\n请创建 .env.local 文件并添加以下环境变量：")
        print("\n# 后端环境变量")
        for var in REQUIRED_BACKEND_VARS:
            print(f"{var}=your_value_here")
        print("\n# 前端环境变量（可选）")
        for var in OPTIONAL_FRONTEND_VARS:
            print(f"# {var}=your_value_here")
        return False
    
    env_vars = load_env_file(env_file)
    
    if not env_vars:
        print("\n[WARN] 警告: .env.local 文件为空或只包含注释")
        return False
    
    print(f"\n找到 {len(env_vars)} 个环境变量\n")
    
    # 检查必需的后端变量
    print("=" * 60)
    print("后端环境变量检查（必需）")
    print("=" * 60)
    
    backend_errors = []
    for var in REQUIRED_BACKEND_VARS:
        if var not in env_vars:
            print(f"[ERROR] {var}: 缺失")
            backend_errors.append(f"{var} 缺失")
        else:
            value = env_vars[var]
            is_valid, message = validate_value(var, value)
            if is_valid:
                # 隐藏敏感信息
                if 'KEY' in var or 'TOKEN' in var:
                    display_value = value[:10] + '...' if len(value) > 10 else value
                else:
                    display_value = value
                print(f"[OK] {var}: {display_value}")
            else:
                print(f"[WARN] {var}: {message}")
                backend_errors.append(f"{var} {message}")
    
    # 检查可选的前端变量
    print("\n" + "=" * 60)
    print("前端环境变量检查（可选）")
    print("=" * 60)
    
    frontend_warnings = []
    for var in OPTIONAL_FRONTEND_VARS:
        if var not in env_vars:
            print(f"[SKIP] {var}: 未设置（可选）")
        else:
            value = env_vars[var]
            if not value or value.startswith('your_'):
                print(f"[SKIP] {var}: 未设置或使用占位符（可选）")
            else:
                is_valid, message = validate_value(var, value)
                if is_valid:
                    print(f"[OK] {var}: {value}")
                else:
                    print(f"[WARN] {var}: {message}")
                    frontend_warnings.append(f"{var} {message}")
    
    # 检查未知变量
    all_known_vars = set(REQUIRED_BACKEND_VARS + OPTIONAL_FRONTEND_VARS)
    unknown_vars = set(env_vars.keys()) - all_known_vars
    if unknown_vars:
        print("\n" + "=" * 60)
        print("未知环境变量")
        print("=" * 60)
        for var in sorted(unknown_vars):
            print(f"[WARN] {var}: 未知变量（可能不需要）")
    
    # 总结
    print("\n" + "=" * 60)
    print("验证结果")
    print("=" * 60)
    
    if backend_errors:
        print(f"\n[ERROR] 发现 {len(backend_errors)} 个错误：")
        for error in backend_errors:
            print(f"  - {error}")
        print("\n请修复这些错误后重新验证。")
        return False
    else:
        print("\n[OK] 所有必需的后端环境变量都已正确配置！")
        if frontend_warnings:
            print(f"\n[WARN] 前端环境变量有 {len(frontend_warnings)} 个警告（可选，不影响运行）：")
            for warning in frontend_warnings:
                print(f"  - {warning}")
        return True

if __name__ == '__main__':
    try:
        success = check_env_vars()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] 验证过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

