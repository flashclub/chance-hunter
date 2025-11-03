const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 颜色替换映射
const colorReplacements = {
  // Blue系列 -> Primary
  'text-blue-600': 'text-primary',
  'text-blue-700': 'text-primary',
  'text-blue-800': 'text-primary/90',
  'bg-blue-600': 'bg-primary',
  'bg-blue-700': 'bg-primary',
  'border-blue-600': 'border-primary',
  'hover:text-blue-600': 'hover:text-primary',
  'hover:text-blue-400': 'hover:text-primary',

  // Gray系列 -> 主题色
  'text-gray-900': 'text-foreground',
  'text-gray-700': 'text-foreground',
  'text-gray-600': 'text-muted-foreground',
  'text-gray-500': 'text-muted-foreground',
  'text-gray-400': 'text-muted-foreground',
  'text-gray-300': 'text-muted-foreground',
  'bg-gray-50': 'bg-muted/50',
  'bg-gray-100': 'bg-muted',
  'bg-gray-800': 'bg-card',
  'bg-gray-900': 'bg-background',
  'border-gray-200': 'border-border',
  'border-gray-600': 'border-border',
  'hover:bg-gray-50': 'hover:bg-muted',
  'hover:bg-gray-100': 'hover:bg-muted',

  // 移除dark:前缀的重复定义
  'dark:text-gray-300': '',
  'dark:text-gray-400': '',
  'dark:bg-gray-700': '',
  'dark:bg-gray-800': '',
  'dark:border-gray-600': '',
  'dark:border-gray-700': '',

  // Green -> muted-gold (成功状态)
  'bg-green-500': 'bg-muted-gold',
  'bg-green-600': 'bg-muted-gold/90',
  'hover:bg-green-600': 'hover:bg-muted-gold/90',

  // Red -> destructive
  'bg-red-50': 'bg-destructive/10',
  'text-red-800': 'text-destructive',
  'border-red-200': 'border-destructive/20',
  'dark:bg-red-900/20': '',
  'dark:border-red-800': '',
  'dark:text-red-300': '',

  // Yellow -> warning (可以保持或改为muted-gold)
  'bg-yellow-400': 'bg-muted-gold',
  'text-yellow-400': 'text-muted-gold',
};

function replaceColorsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    for (const [oldColor, newColor] of Object.entries(colorReplacements)) {
      const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(oldColor)) {
        if (newColor === '') {
          // 移除这个类，同时清理多余的空格
          content = content.replace(new RegExp(`\\s*${oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), ' ');
        } else {
          content = content.replace(regex, newColor);
        }
        hasChanges = true;
        console.log(`✅ ${filePath}: ${oldColor} -> ${newColor || '(removed)'}`);
      }
    }

    if (hasChanges) {
      // 清理多余的空格
      content = content.replace(/\s+/g, ' ').replace(/className="\s+/g, 'className="').replace(/\s+"/g, '"');
      fs.writeFileSync(filePath, content);
    }

    return hasChanges;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 获取所有TSX文件
const files = glob.sync('src/**/*.{tsx,ts}', {
  ignore: ['node_modules/**', '**/*.d.ts']
});

console.log(`🎨 开始替换 ${files.length} 个文件中的颜色...`);

let totalChanges = 0;
files.forEach(file => {
  if (replaceColorsInFile(file)) {
    totalChanges++;
  }
});

console.log(`\n🎉 完成！共修改了 ${totalChanges} 个文件的颜色。`);
console.log('\n📋 替换规则：');
Object.entries(colorReplacements).forEach(([old, newColor]) => {
  if (newColor) {
    console.log(`  ${old} -> ${newColor}`);
  } else {
    console.log(`  ${old} -> (removed)`);
  }
}); 