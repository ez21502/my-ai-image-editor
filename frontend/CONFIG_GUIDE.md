# AI图像重绘应用配置

## 提示词配置

本应用使用内置提示词系统，管理员可以通过修改 `src/config/prompts.json` 文件来配置提示词。

### 配置文件结构

```json
{
  "defaultPrompt": "a beautiful enhancement, high quality, detailed",
  "prompts": [
    "a beautiful enhancement, high quality, detailed",
    "professional photography, stunning visuals, crisp details",
    "vibrant colors, enhanced contrast, artistic style",
    "modern aesthetic, clean design, contemporary look",
    "natural lighting, soft shadows, warm atmosphere",
    "high resolution, sharp focus, premium quality"
  ],
  "settings": {
    "autoSelectPrompt": true,
    "rotatePrompts": false,
    "customPromptEnabled": false
  }
}
```

### 配置选项说明

- **defaultPrompt**: 默认使用的提示词
- **prompts**: 提示词列表，可以添加多个提示词
- **settings.autoSelectPrompt**: 是否自动选择提示词（如果为true，使用当前选中的提示词）
- **settings.rotatePrompts**: 是否轮换提示词（如果为true，每次使用下一个提示词）
- **settings.customPromptEnabled**: 是否启用自定义提示词（当前版本不支持）

### 提示词建议

好的提示词应该：
- 描述清晰具体的图像特征
- 包含风格和质量要求
- 避免模糊或歧义的描述
- 考虑目标用户的审美偏好

### 修改步骤

1. 打开 `src/config/prompts.json` 文件
2. 修改 `prompts` 数组中的提示词
3. 设置合适的 `defaultPrompt`
4. 保存文件并重新构建应用

### 默认提示词

当前默认提示词：`"a beautiful enhancement, high quality, detailed"`

这个提示词适用于大多数图像增强场景，提供了美观、高质量、细节丰富的图像重绘效果。