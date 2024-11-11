require('colors');

const delay = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function displayHeader() {
    process.stdout.write('\x1Bc');
    console.log('========================================'.cyan);
    console.log('=        草地空投机器人 - V2         ='.cyan);
    console.log('=     创建者: HappyCuanAirdrop       ='.cyan);
    console.log('=    https://t.me/HappyCuanAirdrop     ='.cyan);
    console.log('= 由推特 @ferdie_jhovie 进行编译 ='.cyan);
    console.log('========================================'.cyan);
    console.log();
}

module.exports = { delay, displayHeader };
