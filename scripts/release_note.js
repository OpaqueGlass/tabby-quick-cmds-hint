// 从 CHANGELOG.md 中提取最新一个版本段落，写入 result.txt 供 GitHub Release 使用
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const changelogPath = path.join(rootDir, 'CHANGELOG.md')
const outputPath = path.join(rootDir, 'result.txt')

let note = ''

try {
    const changelog = fs.readFileSync(changelogPath, 'utf8')
    // 取第一个 "### " 之后的正文，直到下一个标题（"#"）或文件结尾为止
    const match = changelog.match(/(?<=### )[\s\S]*?(?=#|$)/)
    if (match) {
        note = match[0].trim()
    } else {
        console.warn('CHANGELOG.md 中未找到 "### " 版本段落，将生成空的 Release Notes')
    }
} catch (err) {
    console.warn('读取 CHANGELOG.md 失败：' + err.message)
}

// 显式指定 utf-8，避免不同系统/locale 下出现乱码或 UnicodeEncodeError
fs.writeFileSync(outputPath, note, 'utf8')
console.log('result.txt 已生成（' + note.length + ' 字符）')
